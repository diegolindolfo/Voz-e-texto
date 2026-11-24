import type { AudioSegmentTiming, PrebuiltVoiceName, ReadingMode, ScriptTurn } from '../types';

export interface CacheKeyInput {
  chapterId: string;
  mode: ReadingMode;
  turns: Array<Pick<ScriptTurn, 'id' | 'speaker' | 'style' | 'text' | 'pauseAfterMs'>>;
  voiceMap: Record<string, PrebuiltVoiceName>;
}

/**
 * Pure deterministic FNV-1a 64-bit-equivalent dual-lane hash string so cache keys
 * work identically in both browser and Node without relying on Node-only crypto APIs.
 */
export function computeDeterministicHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b1;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + ((i + 1) & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${part1}${part2}`;
}

export function computeChapterCacheKey(input: CacheKeyInput): string {
  const safeChapter = input.chapterId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'cap';
  const sortedVoices = Object.keys(input.voiceMap)
    .sort()
    .map((speaker) => `${speaker}:${input.voiceMap[speaker]}`)
    .join('|');

  const normalizedTurns = input.turns
    .map((turn) =>
      [
        turn.speaker.trim(),
        turn.style.trim(),
        turn.text.replace(/\s+/g, ' ').trim(),
        String(turn.pauseAfterMs ?? 280),
      ].join('::'),
    )
    .join('\n');

  const payload = `v1|${safeChapter}|${input.mode}|${sortedVoices}|${normalizedTurns}`;
  const hash = computeDeterministicHash(payload);
  return `${safeChapter}-${input.mode === 'dramatized' ? 'mv' : 'solo'}-${hash}`;
}

/**
 * Finds which spoken turn is currently active for a given audio playback timestamp.
 */
export function findActiveSegmentIndex(
  segments: AudioSegmentTiming[],
  currentTimeSec: number,
): number {
  if (segments.length === 0 || currentTimeSec < 0) {
    return -1;
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (currentTimeSec >= seg.startSec && currentTimeSec <= seg.endSec) {
      return i;
    }
    // If playback is inside the brief silence gap after segment i, keep segment i highlighted
    const next = segments[i + 1];
    if (next && currentTimeSec > seg.endSec && currentTimeSec < next.startSec) {
      return i;
    }
  }

  const last = segments[segments.length - 1];
  if (currentTimeSec >= last.endSec) {
    return segments.length - 1;
  }

  return 0;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00';
  }
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 KB';
  }
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/**
 * Splits pasted raw literary prose into clean paragraph turns as an immediate baseline
 * or when editing scripts locally.
 */
export function splitRawTextIntoParagraphs(rawText: string): string[] {
  return rawText
    .split(/\n\s*\n+|\r\n\r\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strips any accidental leading speaker label (e.g. "A Cigarra: ..." or "Narrador: ...")
 * so TTS models read only the pure narrative/dialogue line without announcing character names.
 */
export function stripLeadingSpeakerPrefix(text: string, speakerName?: string): string {
  let cleaned = text.trim();
  if (!cleaned) return '';

  const candidates = [speakerName?.trim(), 'Narrador', 'Contador de Histórias'].filter(
    (item): item is string => Boolean(item && item.length > 0),
  );

  for (const label of candidates) {
    const pattern = new RegExp(`^(?:[—–-]\\s*)?${escapeRegExp(label)}\\s*:\\s*`, 'i');
    if (pattern.test(cleaned)) {
      cleaned = cleaned.replace(pattern, '').trim();
    }
  }

  return cleaned;
}

/**
 * Resolves the effective voice for a turn depending on whether the user chose
 * multi-voice dramatization or single-narrator reading mode.
 */
export function resolveVoiceForTurn(
  turn: ScriptTurn,
  voiceMap: Record<string, PrebuiltVoiceName>,
  mode: ReadingMode,
  primaryNarratorVoice: PrebuiltVoiceName,
): PrebuiltVoiceName {
  if (mode === 'narrator') {
    return primaryNarratorVoice;
  }
  return voiceMap[turn.speaker] ?? primaryNarratorVoice;
}

export interface TtsBatchSpeaker {
  label: string;
  voiceName: PrebuiltVoiceName;
}

export interface TtsBatchTurn {
  turn: ScriptTurn;
  speakerLabel: string;
  voiceName: PrebuiltVoiceName;
}

export interface TtsTurnBatch {
  id: string;
  speakers: TtsBatchSpeaker[];
  turns: TtsBatchTurn[];
  pauseAfterMs: number;
}

/**
 * Computes a deterministic short hash for a single TTS batch so completed batches
 * can be cached individually on disk and resumed seamlessly after a 429 interruption.
 */
export function computeBatchFingerprint(batch: TtsTurnBatch): string {
  const canonical = JSON.stringify({
    v: 2,
    speakers: batch.speakers.map((s) => `${s.label}:${s.voiceName}`),
    turns: batch.turns.map((t) => ({
      s: t.speakerLabel,
      v: t.voiceName,
      st: t.turn.style.trim(),
      tx: stripLeadingSpeakerPrefix(t.turn.text, t.speakerLabel),
    })),
  });
  let h1 = 0xdeadbeef ^ canonical.length;
  let h2 = 0x41c6ce57 ^ canonical.length;
  for (let i = 0; i < canonical.length; i++) {
    const ch = canonical.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Greedily groups consecutive turns into 1-speaker or 2-speaker batches so
 * gemini-3.8-flash-tts can synthesize entire multi-turn scenes using native
 * multiSpeakerVoiceConfig (max 2 speakers per call) with minimal API requests.
 */
export function batchTurnsForTts(
  turns: ScriptTurn[],
  voiceMap: Record<string, PrebuiltVoiceName>,
  mode: ReadingMode,
  primaryNarratorVoice: PrebuiltVoiceName,
  maxCharsPerBatch = 3400,
): TtsTurnBatch[] {
  const batches: TtsTurnBatch[] = [];

  for (const turn of turns) {
    const voiceName = resolveVoiceForTurn(turn, voiceMap, mode, primaryNarratorVoice);
    const speakerLabel = mode === 'narrator' ? 'Narrador' : turn.speaker;
    const current = batches[batches.length - 1];

    if (current) {
      const existingSpeaker = current.speakers.find((s) => s.label === speakerLabel);
      const existingVoiceConflict = current.speakers.find(
        (s) => s.voiceName === voiceName && s.label !== speakerLabel,
      );
      const currentChars = current.turns.reduce((sum, item) => sum + item.turn.text.length, 0);
      const fitsChars = currentChars + turn.text.length <= maxCharsPerBatch;

      if (
        fitsChars &&
        !existingVoiceConflict &&
        (existingSpeaker || current.speakers.length < 2)
      ) {
        if (!existingSpeaker) {
          current.speakers.push({ label: speakerLabel, voiceName });
        }
        current.turns.push({ turn, speakerLabel, voiceName });
        current.pauseAfterMs = turn.pauseAfterMs ?? 300;
        continue;
      }
    }

    batches.push({
      id: `batch-${batches.length + 1}`,
      speakers: [{ label: speakerLabel, voiceName }],
      turns: [{ turn, speakerLabel, voiceName }],
      pauseAfterMs: turn.pauseAfterMs ?? 300,
    });
  }

  return batches;
}

function computeTurnTimingWeight(text: string): number {
  const trimmed = text.trim();
  const sentenceStops = (trimmed.match(/[.!?…]+/g) ?? []).length;
  const minorPauses = (trimmed.match(/[,;:—]+/g) ?? []).length;
  return Math.max(1, trimmed.length + sentenceStops * 12 + minorPauses * 4);
}

/**
 * Maps merged batch WAV timestamps back to individual turns, snapping split boundaries
 * to real detected PCM silence gaps when available (falling back to punctuation-weighted
 * text proportionality).
 */
export function expandBatchTimingsToTurns(
  batches: TtsTurnBatch[],
  batchTimings: Array<{ id: string; startSec: number; endSec: number }>,
  batchSilences?: Array<Array<{ timeSec: number; durationMs: number }>>,
): AudioSegmentTiming[] {
  const segments: AudioSegmentTiming[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const timing = batchTimings[i];
    if (!timing) continue;

    if (batch.turns.length === 1) {
      const only = batch.turns[0];
      segments.push({
        turnId: only.turn.id,
        speaker: only.turn.speaker,
        voiceName: only.voiceName,
        startSec: Number(timing.startSec.toFixed(3)),
        endSec: Number(timing.endSec.toFixed(3)),
      });
      continue;
    }

    const span = Math.max(0, timing.endSec - timing.startSec);
    const weights = batch.turns.map((item) => computeTurnTimingWeight(item.turn.text));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const silences = batchSilences?.[i] ?? [];
    const searchRadiusSec = Math.min(4.5, Math.max(1.5, span * 0.28));

    const boundaryOffsets: number[] = [0];
    let accumWeight = 0;
    let prevSplitSec = 0;

    for (let j = 0; j < batch.turns.length - 1; j++) {
      accumWeight += weights[j];
      const expectedSec = (span * accumWeight) / totalWeight;
      const minAllowed = prevSplitSec + 0.25;
      const remainingTurns = batch.turns.length - 1 - j;
      const maxAllowed = Math.max(minAllowed, span - remainingTurns * 0.25);

      let chosenSplitSec = Math.min(maxAllowed, Math.max(minAllowed, expectedSec));

      if (silences.length > 0) {
        let bestCandidate: { timeSec: number; score: number } | null = null;
        for (const s of silences) {
          if (s.timeSec < minAllowed || s.timeSec > maxAllowed) continue;
          const dist = Math.abs(s.timeSec - expectedSec);
          if (dist > searchRadiusSec) continue;
          const score = s.durationMs - dist * 140;
          if (!bestCandidate || score > bestCandidate.score) {
            bestCandidate = { timeSec: s.timeSec, score };
          }
        }
        if (bestCandidate) {
          chosenSplitSec = bestCandidate.timeSec;
        }
      }

      boundaryOffsets.push(chosenSplitSec);
      prevSplitSec = chosenSplitSec;
    }
    boundaryOffsets.push(span);

    for (let j = 0; j < batch.turns.length; j++) {
      const item = batch.turns[j];
      const startSec = timing.startSec + boundaryOffsets[j];
      const endSec = j === batch.turns.length - 1 ? timing.endSec : timing.startSec + boundaryOffsets[j + 1];
      segments.push({
        turnId: item.turn.id,
        speaker: item.turn.speaker,
        voiceName: item.voiceName,
        startSec: Number(startSec.toFixed(3)),
        endSec: Number(endSec.toFixed(3)),
      });
    }
  }

  return segments;
}
