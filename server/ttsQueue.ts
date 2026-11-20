import { AdaptivePacer, isDailyQuotaError } from '../src/lib/rateLimit';
import { computeChapterCacheKey } from '../src/lib/scriptParser';
import type {
  CachedAudioMetadata,
  PrebuiltVoiceName,
  ReadingMode,
  ScriptTurn,
  TtsJobProgress,
  TtsQueueItem,
  TtsStatusResponse,
} from '../src/types';
import { readCachedAudio, writeCachedAudio } from './audioCache';
import { getChapterById } from './bookLibrary';
import { formatGeminiError, synthesizeChapterAudio } from './gemini';

interface BackgroundTask {
  item: TtsQueueItem;
  bookTitle: string;
  turns: ScriptTurn[];
  voiceMap: Record<string, PrebuiltVoiceName>;
  cacheKey: string;
}

const pacer = new AdaptivePacer(2000);
let pacingSec = 4;
let activeJob: TtsJobProgress | null = null;
let dailyQuotaPaused = false;
let dailyQuotaMessage: string | undefined;

const inflightForeground = new Map<string, Promise<CachedAudioMetadata>>();
const queueTasks: BackgroundTask[] = [];
let workerChain: Promise<void> = Promise.resolve();
let workerRunning = false;

function serializeExecution<T>(fn: () => Promise<T>): Promise<T> {
  const run = workerChain.then(fn, fn);
  workerChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function setTtsPacingSec(seconds: number): number {
  const clamped = Math.max(1, Math.min(30, Math.round(seconds)));
  pacingSec = clamped;
  pacer.setBaseSpacingMs(clamped * 1000);
  return pacingSec;
}

export function getTtsStatus(): TtsStatusResponse {
  return {
    activeJob,
    queue: queueTasks.map((t) => ({ ...t.item })),
    pacingSec,
    dailyQuotaPaused,
    dailyQuotaMessage,
  };
}

export async function runForegroundSynthesis(params: {
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  mode: ReadingMode;
  turns: ScriptTurn[];
  voiceMap: Record<string, PrebuiltVoiceName>;
  forceRegenerate?: boolean;
}): Promise<{ metadata: CachedAudioMetadata; cached: boolean }> {
  const safeMode: ReadingMode = params.mode === 'narrator' ? 'narrator' : 'dramatized';
  const safeVoiceMap = params.voiceMap ?? {};
  const cacheKey = computeChapterCacheKey({
    chapterId: params.chapterId,
    mode: safeMode,
    turns: params.turns,
    voiceMap: safeVoiceMap,
  });

  if (!params.forceRegenerate) {
    const existing = readCachedAudio(cacheKey);
    if (existing) {
      return { metadata: existing, cached: true };
    }
  }

  let promise = inflightForeground.get(cacheKey);
  if (!promise) {
    promise = serializeExecution(async () => {
      if (!params.forceRegenerate) {
        const rechecked = readCachedAudio(cacheKey);
        if (rechecked) return rechecked;
      }

      dailyQuotaPaused = false;
      dailyQuotaMessage = undefined;

      try {
        const result = await synthesizeChapterAudio({
          turns: params.turns,
          voiceMap: safeVoiceMap,
          mode: safeMode,
          cacheKey,
          forceRegenerate: params.forceRegenerate,
          pacer,
          minSpacingMs: Math.min(pacingSec * 1000, 3000),
          onProgress: (progress) => {
            activeJob = {
              chapterId: params.chapterId,
              chapterTitle: params.chapterTitle,
              cacheKey,
              source: 'foreground',
              ...progress,
            };
          },
        });

        const saved = writeCachedAudio(cacheKey, result.wavBuffer, {
          chapterId: params.chapterId,
          bookTitle: params.bookTitle,
          chapterTitle: params.chapterTitle,
          mode: safeMode,
          voiceMap: safeVoiceMap,
          durationSec: result.durationSec,
          segments: result.segments,
        });

        // Mark any matching queued item as done
        for (const q of queueTasks) {
          if (q.cacheKey === cacheKey) {
            q.item.status = 'done';
          }
        }

        return saved;
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err ?? '');
        if (isDailyQuotaError(raw)) {
          dailyQuotaPaused = true;
          dailyQuotaMessage = formatGeminiError(err, 'Cota diária atingida.');
        }
        throw err;
      } finally {
        if (activeJob?.cacheKey === cacheKey) {
          activeJob = null;
        }
      }
    }).finally(() => {
      inflightForeground.delete(cacheKey);
    });

    inflightForeground.set(cacheKey, promise);
  }

  const metadata = await promise;
  return { metadata, cached: false };
}

function scheduleBackgroundWorker(): void {
  if (workerRunning) return;
  workerRunning = true;

  void (async () => {
    try {
      while (true) {
        if (dailyQuotaPaused) break;
        const nextTask = queueTasks.find((t) => t.item.status === 'queued');
        if (!nextTask) break;

        await serializeExecution(async () => {
          if (dailyQuotaPaused || nextTask.item.status !== 'queued') return;

          const existing = readCachedAudio(nextTask.cacheKey);
          if (existing) {
            nextTask.item.status = 'done';
            return;
          }

          nextTask.item.status = 'running';
          try {
            const result = await synthesizeChapterAudio({
              turns: nextTask.turns,
              voiceMap: nextTask.voiceMap,
              mode: nextTask.item.mode,
              cacheKey: nextTask.cacheKey,
              pacer,
              minSpacingMs: pacingSec * 1000,
              onProgress: (progress) => {
                activeJob = {
                  chapterId: nextTask.item.chapterId,
                  chapterTitle: nextTask.item.chapterTitle,
                  cacheKey: nextTask.cacheKey,
                  source: 'queue',
                  ...progress,
                };
              },
            });

            writeCachedAudio(nextTask.cacheKey, result.wavBuffer, {
              chapterId: nextTask.item.chapterId,
              bookTitle: nextTask.bookTitle,
              chapterTitle: nextTask.item.chapterTitle,
              mode: nextTask.item.mode,
              voiceMap: nextTask.voiceMap,
              durationSec: result.durationSec,
              segments: result.segments,
            });
            nextTask.item.status = 'done';
          } catch (err) {
            const raw = err instanceof Error ? err.message : String(err ?? '');
            const friendly = formatGeminiError(err, 'Falha ao pré-gerar capítulo.');
            nextTask.item.status = 'failed';
            nextTask.item.error = friendly;
            if (isDailyQuotaError(raw)) {
              dailyQuotaPaused = true;
              dailyQuotaMessage = friendly;
            }
          } finally {
            if (activeJob?.cacheKey === nextTask.cacheKey) {
              activeJob = null;
            }
          }
        });
      }
    } finally {
      workerRunning = false;
    }
  })();
}

export function enqueueBackgroundChapters(params: {
  bookId: string;
  chapterIds: string[];
  mode: ReadingMode;
  pacingSec?: number;
}): { added: number; skippedCached: number; status: TtsStatusResponse } {
  if (typeof params.pacingSec === 'number' && Number.isFinite(params.pacingSec)) {
    setTtsPacingSec(params.pacingSec);
  }

  dailyQuotaPaused = false;
  dailyQuotaMessage = undefined;

  let added = 0;
  let skippedCached = 0;
  const safeMode: ReadingMode = params.mode === 'narrator' ? 'narrator' : 'dramatized';

  // Trim old completed/failed items if list gets long
  while (queueTasks.length > 25) {
    const finishedIdx = queueTasks.findIndex(
      (t) => t.item.status === 'done' || t.item.status === 'failed',
    );
    if (finishedIdx >= 0) {
      queueTasks.splice(finishedIdx, 1);
    } else {
      break;
    }
  }

  for (const chapterId of params.chapterIds.slice(0, 12)) {
    const found = getChapterById(params.bookId, chapterId);
    if (!found) continue;

    const voiceMap: Record<string, PrebuiltVoiceName> = {};
    for (const ch of found.chapter.characters) {
      voiceMap[ch.name] = ch.defaultVoice;
    }

    const cacheKey = computeChapterCacheKey({
      chapterId: found.chapter.id,
      mode: safeMode,
      turns: found.chapter.turns,
      voiceMap,
    });

    if (readCachedAudio(cacheKey)) {
      skippedCached += 1;
      continue;
    }

    const alreadyQueued = queueTasks.some(
      (t) =>
        t.cacheKey === cacheKey && (t.item.status === 'queued' || t.item.status === 'running'),
    );
    if (alreadyQueued) continue;

    queueTasks.push({
      item: {
        id: `${found.chapter.id}-${Date.now().toString(36).slice(-4)}`,
        bookId: found.book.id,
        chapterId: found.chapter.id,
        chapterTitle: `${found.chapter.numberLabel} — ${found.chapter.title}`,
        mode: safeMode,
        status: 'queued',
      },
      bookTitle: found.book.title,
      turns: found.chapter.turns,
      voiceMap,
      cacheKey,
    });
    added += 1;
  }

  if (added > 0) {
    scheduleBackgroundWorker();
  }

  return {
    added,
    skippedCached,
    status: getTtsStatus(),
  };
}

export function clearBackgroundQueue(): TtsStatusResponse {
  for (let i = queueTasks.length - 1; i >= 0; i--) {
    if (queueTasks[i].item.status !== 'running') {
      queueTasks.splice(i, 1);
    }
  }
  dailyQuotaPaused = false;
  dailyQuotaMessage = undefined;
  return getTtsStatus();
}

export function removeQueueItem(chapterId: string): TtsStatusResponse {
  const idx = queueTasks.findIndex(
    (t) => t.item.chapterId === chapterId && t.item.status !== 'running',
  );
  if (idx >= 0) {
    queueTasks.splice(idx, 1);
  }
  return getTtsStatus();
}
