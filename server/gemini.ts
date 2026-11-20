import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AudioSegmentTiming,
  ChapterCharacter,
  PrebuiltVoiceName,
  ReadingMode,
  ScriptTurn,
} from '../src/types';
import { concatWavClips } from '../src/lib/wav';
import {
  AdaptivePacer,
  computeBackoffDelayMs,
  isDailyQuotaError,
  isRateLimitError,
  isRetryableGeminiError,
  parseRetryDelayMs,
} from '../src/lib/rateLimit';
import {
  batchTurnsForTts,
  computeBatchFingerprint,
  expandBatchTimingsToTurns,
  type TtsTurnBatch,
} from '../src/lib/scriptParser';
import {
  clearPartialBatchCache,
  readPartialBatchWav,
  writePartialBatchWav,
} from './audioCache';

const VALID_VOICES: PrebuiltVoiceName[] = ['Charon', 'Kore', 'Puck', 'Fenrir', 'Zephyr'];

function getGeminiClient(apiVersion?: 'v1beta'): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'Chave da API Gemini não configurada no servidor. Verifique as configurações de segredos do ambiente.',
    );
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function formatGeminiError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  if (!raw) return fallback;

  if (isDailyQuotaError(raw)) {
    return 'Cota diária da IA atingida para geração de voz. Você pode ouvir as fábulas já pré-renderizadas em cache WAV ou usar a voz local do dispositivo.';
  }

  try {
    const parsed = JSON.parse(raw) as { error?: { code?: number; message?: string; status?: string } };
    const code = parsed.error?.code;
    const status = parsed.error?.status ?? '';
    const msg = parsed.error?.message ?? '';

    if (code === 403 || status === 'PERMISSION_DENIED' || msg.includes('API_KEY_INVALID')) {
      return 'Chave da API Gemini inválida ou sem permissão. Verifique o painel Settings > Secrets.';
    }
    if (code === 429 || status === 'RESOURCE_EXHAUSTED') {
      return 'Limite de requisições por minuto atingido. As partes já pré-renderizadas ficaram salvas — tente novamente em instantes ou ouça os contos já em cache.';
    }
    if (msg) {
      return `${fallback} (${msg.slice(0, 160)})`;
    }
  } catch {
    // Plain error string
  }

  if (raw.includes('API_KEY_INVALID') || raw.includes('PERMISSION_DENIED')) {
    return 'Chave da API Gemini inválida ou sem permissão. Verifique o painel Settings > Secrets.';
  }
  if (isRateLimitError(raw)) {
    return 'Limite de requisições atingido no momento. As partes já geradas ficaram salvas — aguarde alguns instantes ou use a voz local.';
  }
  return raw.length > 220 ? `${raw.slice(0, 220)}…` : raw;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    pacer?: AdaptivePacer;
    onWaitingRetry?: (waitSec: number) => void;
  },
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 4;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      options?.pacer?.recordSuccess();
      return result;
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);

      if (isRateLimitError(msg)) {
        const parsedDelay = parseRetryDelayMs(msg);
        options?.pacer?.recordRateLimit(parsedDelay);
      }

      if (!isRetryableGeminiError(msg) || attempt === maxAttempts) {
        throw error;
      }

      const waitMs = computeBackoffDelayMs({
        attempt,
        errorText: msg,
        adaptivePacingMs: options?.pacer?.getSpacingMs(),
      });
      options?.onWaitingRetry?.(Math.max(1, Math.ceil(waitMs / 1000)));
      await sleep(waitMs);
    }
  }
  throw lastError;
}

async function synthesizeSingleVoiceLiteWav(
  ai: GoogleGenAI,
  textParts: Array<{ text: string }>,
  voiceName: PrebuiltVoiceName,
  options?: {
    pacer?: AdaptivePacer;
    onWaitingRetry?: (waitSec: number) => void;
  },
): Promise<Uint8Array> {
  const response = await withRetry(
    () =>
      ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: textParts,
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      }),
    {
      maxAttempts: 4,
      pacer: options?.pacer,
      onWaitingRetry: options?.onWaitingRetry,
    },
  );

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('O modelo de voz lite não retornou dados de áudio para este trecho.');
  }
  return new Uint8Array(Buffer.from(base64Audio, 'base64'));
}

let primaryFlashTtsDailyQuotaExhausted = false;

async function synthesizeWithLiteFallback(
  ai: GoogleGenAI,
  batch: TtsTurnBatch,
  options?: {
    pacer?: AdaptivePacer;
    onWaitingRetry?: (waitSec: number) => void;
  },
): Promise<Uint8Array> {
  const isDualSpeaker = batch.speakers.length === 2;
  if (!isDualSpeaker) {
    const soloSpeaker = batch.speakers[0];
    return synthesizeSingleVoiceLiteWav(
      ai,
      batch.turns.map((item) => ({ text: item.turn.text })),
      soloSpeaker.voiceName,
      options,
    );
  }

  const turnClips: Array<{ id: string; wavBuffer: Uint8Array; pauseAfterMs: number }> = [];
  for (let idx = 0; idx < batch.turns.length; idx++) {
    if (idx > 0) {
      const waitMs = options?.pacer ? options.pacer.getRequiredWaitMs(Date.now(), 2200) : 2200;
      if (waitMs > 0) {
        await sleep(waitMs);
      }
    }
    const item = batch.turns[idx];
    const wavBuffer = await synthesizeSingleVoiceLiteWav(
      ai,
      [{ text: item.turn.text }],
      item.voiceName,
      options,
    );
    turnClips.push({
      id: item.turn.id,
      wavBuffer,
      pauseAfterMs: idx === batch.turns.length - 1 ? 0 : item.turn.pauseAfterMs ?? 240,
    });
  }
  return concatWavClips(turnClips).wavBuffer;
}

async function synthesizeBatchWav(
  ai: GoogleGenAI,
  batch: TtsTurnBatch,
  options?: {
    pacer?: AdaptivePacer;
    onWaitingRetry?: (waitSec: number) => void;
  },
): Promise<Uint8Array> {
  if (primaryFlashTtsDailyQuotaExhausted) {
    return synthesizeWithLiteFallback(ai, batch, options);
  }

  const isDualSpeaker = batch.speakers.length === 2;

  try {
    const response = await withRetry(
      () => {
        if (isDualSpeaker) {
          return ai.models.generateContent({
            model: 'gemini-3.8-flash-tts',
            contents: [
              {
                role: 'user',
                parts: batch.turns.map((item) => ({
                  text: `${item.speakerLabel}: ${item.turn.text}`,
                  speechMetadata: {
                    speaker: item.speakerLabel,
                    style: `${item.turn.style}. Contação de histórias e fábulas infantis em português do Brasil, expressiva e natural.`,
                  },
                })),
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                multiSpeakerVoiceConfig: {
                  speakerVoiceConfigs: batch.speakers.map((sp) => ({
                    speaker: sp.label,
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: sp.voiceName },
                    },
                  })),
                },
              },
            },
          });
        }

        const soloSpeaker = batch.speakers[0];
        return ai.models.generateContent({
          model: 'gemini-3.8-flash-tts',
          contents: [
            {
              role: 'user',
              parts: batch.turns.map((item) => ({
                text: item.turn.text,
                speechMetadata: {
                  style: `${item.turn.style}. Contação de histórias e fábulas infantis em português do Brasil, expressiva e natural.`,
                },
              })),
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: soloSpeaker.voiceName },
              },
            },
          },
        });
      },
      {
        maxAttempts: 3,
        pacer: options?.pacer,
        onWaitingRetry: options?.onWaitingRetry,
      },
    );

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('O modelo de voz não retornou dados de áudio para este trecho.');
    }
    return new Uint8Array(Buffer.from(base64Audio, 'base64'));
  } catch (primaryError) {
    const msg = primaryError instanceof Error ? primaryError.message : String(primaryError);
    if (isDailyQuotaError(msg)) {
      primaryFlashTtsDailyQuotaExhausted = true;
    } else if (!isRateLimitError(msg)) {
      throw primaryError;
    }

    return synthesizeWithLiteFallback(ai, batch, options);
  }
}

export interface SynthesisProgressUpdate {
  state: 'synthesizing' | 'waiting_retry';
  completedBatches: number;
  totalBatches: number;
  reusedBatches: number;
  waitingRetrySec?: number;
}

/**
 * Synthesizes an entire fable or fairy tale with multiple natural voices using gemini-3.8-flash-tts,
 * grouping consecutive turns into larger 1- or 2-speaker batches, caching each batch
 * partially on disk so interrupted chapters resume with zero wasted calls, and pacing
 * requests adaptively to respect API quotas.
 */
export async function synthesizeChapterAudio(params: {
  turns: ScriptTurn[];
  voiceMap: Record<string, PrebuiltVoiceName>;
  mode: ReadingMode;
  cacheKey?: string;
  forceRegenerate?: boolean;
  pacer?: AdaptivePacer;
  minSpacingMs?: number;
  onProgress?: (progress: SynthesisProgressUpdate) => void;
}): Promise<{
  wavBuffer: Uint8Array;
  durationSec: number;
  segments: AudioSegmentTiming[];
  reusedBatches: number;
  totalBatches: number;
}> {
  const ai = getGeminiClient('v1beta');
  const { turns, voiceMap, mode, cacheKey, forceRegenerate, pacer, minSpacingMs, onProgress } =
    params;

  const narratorTurn = turns.find((t) => t.role === 'narrator') ?? turns[0];
  const primaryNarratorVoice: PrebuiltVoiceName =
    (narratorTurn && voiceMap[narratorTurn.speaker]) || 'Charon';

  const batches = batchTurnsForTts(turns, voiceMap, mode, primaryNarratorVoice);

  if (cacheKey && forceRegenerate) {
    clearPartialBatchCache(cacheKey);
  }

  const clipInputs: Array<{ id: string; wavBuffer: Uint8Array; pauseAfterMs: number }> = [];
  let reusedBatches = 0;

  onProgress?.({
    state: 'synthesizing',
    completedBatches: 0,
    totalBatches: batches.length,
    reusedBatches: 0,
  });

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const fingerprint = computeBatchFingerprint(batch);

    let wavBuffer: Uint8Array | null =
      cacheKey && !forceRegenerate ? readPartialBatchWav(cacheKey, i, fingerprint) : null;

    if (wavBuffer) {
      reusedBatches += 1;
    } else {
      if (pacer) {
        const requiredWait = pacer.getRequiredWaitMs(Date.now(), minSpacingMs ?? 0);
        if (requiredWait > 0) {
          if (requiredWait >= 2500) {
            onProgress?.({
              state: 'waiting_retry',
              completedBatches: i,
              totalBatches: batches.length,
              reusedBatches,
              waitingRetrySec: Math.ceil(requiredWait / 1000),
            });
          }
          await sleep(requiredWait);
        }
      }

      onProgress?.({
        state: 'synthesizing',
        completedBatches: i,
        totalBatches: batches.length,
        reusedBatches,
      });

      wavBuffer = await synthesizeBatchWav(ai, batch, {
        pacer,
        onWaitingRetry: (waitSec) => {
          onProgress?.({
            state: 'waiting_retry',
            completedBatches: i,
            totalBatches: batches.length,
            reusedBatches,
            waitingRetrySec: waitSec,
          });
        },
      });

      if (cacheKey) {
        writePartialBatchWav(cacheKey, i, fingerprint, wavBuffer);
      }
    }

    clipInputs.push({
      id: batch.id,
      wavBuffer,
      pauseAfterMs: batch.pauseAfterMs,
    });

    onProgress?.({
      state: 'synthesizing',
      completedBatches: i + 1,
      totalBatches: batches.length,
      reusedBatches,
    });
  }

  const merged = concatWavClips(clipInputs);
  const segments = expandBatchTimingsToTurns(batches, merged.timings);

  if (cacheKey) {
    clearPartialBatchCache(cacheKey);
  }

  return {
    wavBuffer: merged.wavBuffer,
    durationSec: merged.durationSec,
    segments,
    reusedBatches,
    totalBatches: batches.length,
  };
}

/**
 * Analyzes a raw public-domain fable or children's tale excerpt into
 * dramatic multi-voice turns, character voices, vocal style cues, and moral lesson.
 */
export async function analyzeLiteraryExcerpt(params: {
  title: string;
  rawText: string;
}): Promise<{
  summary: string;
  moral: string;
  aiNotes: string;
  characters: ChapterCharacter[];
  turns: ScriptTurn[];
}> {
  const ai = getGeminiClient();

  const prompt = `Analise a fábula ou conto infantil em domínio público abaixo e pré-ajuste o texto em um roteiro de contação dramatizada com múltiplas vozes naturais em português do Brasil.

Regras obrigatórias:
1. Preserve o texto da história integralmente, separando o Contador de Histórias (narrador) e as falas diretas dos personagens (animais, fadas, crianças, reis, etc.) em turnos claros (máximo de 10 turnos).
2. Para cada personagem/narrador, escolha a voz mais adequada entre exatamente estas opções: Charon, Kore, Puck, Fenrir, Zephyr.
   - Charon: voz grave e acolhedora (Contador de Histórias, avôs, narradores)
   - Kore: voz feminina clara e maternal (mães, fadas, rainhas, tartaruga, animais sábios)
   - Puck: voz jovem, saltitante e ágil (crianças, ratinhos, lebres, gatos de botas, heróis)
   - Fenrir: voz firme, profunda e imponente (leões, lobos, gigantes, reis, corvos)
   - Zephyr: voz leve, musical e encantada (cigarras, raposas astutas, princesas, cisnes)
3. Escreva uma direção vocal expressiva em português (campo "style") descrevendo o tom, o ritmo e a emoção de cada fala para leitura infantil.
4. Extraia ou formule a moral da fábula / ensinamento do conto em uma frase clara no campo "moral".

Título da fábula ou conto: ${params.title}

Texto original:
${params.rawText}`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: 'Resumo encantador de 1 frase da fábula ou conto infantil em português.',
            },
            moral: {
              type: Type.STRING,
              description: 'Moral da fábula ou ensinamento principal do conto em 1 frase.',
            },
            aiNotes: {
              type: Type.STRING,
              description: 'Resumo técnico curto do ajuste vocal feito pela IA (ex.: Roteiro pré-ajustado por IA · 3 vozes e pausas expressivas).',
            },
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  role: { type: Type.STRING, enum: ['narrator', 'character'] },
                  description: { type: Type.STRING },
                  defaultVoice: {
                    type: Type.STRING,
                    enum: ['Charon', 'Kore', 'Puck', 'Fenrir', 'Zephyr'],
                  },
                  defaultStyle: { type: Type.STRING },
                },
                required: ['name', 'role', 'description', 'defaultVoice', 'defaultStyle'],
              },
            },
            turns: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  speaker: { type: Type.STRING },
                  role: { type: Type.STRING, enum: ['narrator', 'character'] },
                  style: { type: Type.STRING },
                  text: { type: Type.STRING },
                  pauseAfterMs: { type: Type.INTEGER },
                },
                required: ['speaker', 'role', 'style', 'text'],
              },
            },
          },
          required: ['summary', 'moral', 'aiNotes', 'characters', 'turns'],
        },
      },
    }),
  );

  const rawJson = (response.text ?? '').trim();
  if (!rawJson) {
    throw new Error('A análise do conto não retornou resultado estruturado.');
  }

  const parsed = JSON.parse(rawJson) as {
    summary: string;
    moral?: string;
    aiNotes?: string;
    characters: Array<{
      name: string;
      role: 'narrator' | 'character';
      description: string;
      defaultVoice: string;
      defaultStyle: string;
    }>;
    turns: Array<{
      speaker: string;
      role: 'narrator' | 'character';
      style: string;
      text: string;
      pauseAfterMs?: number;
    }>;
  };

  const characters: ChapterCharacter[] = (parsed.characters ?? []).map((c, idx) => ({
    name: c.name?.trim() || (idx === 0 ? 'Contador de Histórias' : `Personagem ${idx}`),
    role: c.role === 'character' ? 'character' : 'narrator',
    description: c.description?.trim() || 'Voz interpretativa do conto.',
    defaultVoice: VALID_VOICES.includes(c.defaultVoice as PrebuiltVoiceName)
      ? (c.defaultVoice as PrebuiltVoiceName)
      : 'Charon',
    defaultStyle: c.defaultStyle?.trim() || 'Contação expressiva em português brasileiro',
  }));

  const turns: ScriptTurn[] = (parsed.turns ?? [])
    .filter((t) => t.text && t.text.trim().length > 0)
    .map((t, idx) => ({
      id: `custom-t-${Date.now()}-${idx}`,
      speaker: t.speaker?.trim() || characters[0]?.name || 'Contador de Histórias',
      role: t.role === 'character' ? 'character' : 'narrator',
      style: t.style?.trim() || 'Contação expressiva e acolhedora',
      text: t.text.trim(),
      pauseAfterMs:
        typeof t.pauseAfterMs === 'number' && t.pauseAfterMs >= 120 && t.pauseAfterMs <= 800
          ? t.pauseAfterMs
          : 300,
    }));

  if (turns.length === 0) {
    throw new Error('Não foi possível extrair falas válidas do conto enviado.');
  }

  return {
    summary:
      parsed.summary?.trim() ||
      'Fábula ou conto infantil pré-ajustado por IA para leitura em múltiplas vozes.',
    moral:
      parsed.moral?.trim() ||
      'Toda boa história guarda uma semente de sabedoria para quem sabe escutar.',
    aiNotes:
      parsed.aiNotes?.trim() ||
      `Roteiro pré-ajustado por IA · ${characters.length} vozes calibradas para leitura dramatizada`,
    characters:
      characters.length > 0
        ? characters
        : [
            {
              name: 'Contador de Histórias',
              role: 'narrator',
              description: 'Voz narrativa principal.',
              defaultVoice: 'Charon',
              defaultStyle: 'Contador de histórias em português brasileiro',
            },
          ],
    turns,
  };
}
