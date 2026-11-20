import type { CachedAudioMetadata, CacheInventoryResponse, CacheSummaryItem } from '../types';

export const STATIC_PRERENDERED_AUDIOS: Record<string, CachedAudioMetadata> = {
  'esopo-cigarra-formiga-mv-aae4b20ec72aa6d1': {
    chapterId: 'esopo-cigarra-formiga',
    bookTitle: 'Fábulas de Esopo',
    chapterTitle: 'A Cigarra e a Formiga',
    mode: 'dramatized',
    voiceMap: {
      'Contador de Histórias': 'Charon',
      'A Cigarra': 'Zephyr',
      'A Formiga': 'Kore',
    },
    durationSec: 87.62,
    segments: [
      {
        turnId: 'ecf-t1',
        speaker: 'Contador de Histórias',
        voiceName: 'Charon',
        startSec: 0,
        endSec: 23.55,
      },
      {
        turnId: 'ecf-t2',
        speaker: 'A Cigarra',
        voiceName: 'Zephyr',
        startSec: 23.55,
        endSec: 35.56,
      },
      {
        turnId: 'ecf-t3',
        speaker: 'A Formiga',
        voiceName: 'Kore',
        startSec: 35.84,
        endSec: 47.082,
      },
      {
        turnId: 'ecf-t4',
        speaker: 'Contador de Histórias',
        voiceName: 'Charon',
        startSec: 47.082,
        endSec: 59.6,
      },
      {
        turnId: 'ecf-t5',
        speaker: 'A Cigarra',
        voiceName: 'Zephyr',
        startSec: 59.9,
        endSec: 68.456,
      },
      {
        turnId: 'ecf-t6',
        speaker: 'A Formiga',
        voiceName: 'Kore',
        startSec: 68.456,
        endSec: 87.62,
      },
    ],
    cacheKey: 'esopo-cigarra-formiga-mv-aae4b20ec72aa6d1',
    fileSizeBytes: 4205804,
    createdAt: '2026-11-20T00:57:26.312Z',
    audioUrl: '/audio-cache/esopo-cigarra-formiga-mv-aae4b20ec72aa6d1.wav',
  },
  'esopo-lebre-tartaruga-mv-7ed0fb234bc28609': {
    chapterId: 'esopo-lebre-tartaruga',
    bookTitle: 'Fábulas de Esopo',
    chapterTitle: 'A Lebre e a Tartaruga',
    mode: 'dramatized',
    voiceMap: {
      'Contador de Histórias': 'Charon',
      'A Lebre': 'Puck',
      'A Tartaruga': 'Kore',
    },
    durationSec: 58.32,
    segments: [
      {
        turnId: 'elt-t1',
        speaker: 'Contador de Histórias',
        voiceName: 'Charon',
        startSec: 0,
        endSec: 11.323,
      },
      {
        turnId: 'elt-t2',
        speaker: 'A Lebre',
        voiceName: 'Puck',
        startSec: 11.323,
        endSec: 18.4,
      },
      {
        turnId: 'elt-t3',
        speaker: 'A Tartaruga',
        voiceName: 'Kore',
        startSec: 18.66,
        endSec: 26.991,
      },
      {
        turnId: 'elt-t4',
        speaker: 'Contador de Histórias',
        voiceName: 'Charon',
        startSec: 26.991,
        endSec: 46.5,
      },
      {
        turnId: 'elt-t5',
        speaker: 'A Lebre',
        voiceName: 'Puck',
        startSec: 46.86,
        endSec: 52.025,
      },
      {
        turnId: 'elt-t6',
        speaker: 'A Tartaruga',
        voiceName: 'Kore',
        startSec: 52.025,
        endSec: 58.32,
      },
    ],
    cacheKey: 'esopo-lebre-tartaruga-mv-7ed0fb234bc28609',
    fileSizeBytes: 2799404,
    createdAt: '2026-11-20T00:59:13.177Z',
    audioUrl: '/audio-cache/esopo-lebre-tartaruga-mv-7ed0fb234bc28609.wav',
  },
  'andersen-patinho-feio-mv-bebf3a19a6217735': {
    chapterId: 'andersen-patinho-feio',
    bookTitle: 'Contos de Hans Christian Andersen',
    chapterTitle: 'O Patinho Feio',
    mode: 'dramatized',
    voiceMap: {
      'Contador de Histórias': 'Charon',
      'Mãe Pata': 'Kore',
      'O Jovem Patinho': 'Puck',
      'O Cisne Real': 'Zephyr',
    },
    durationSec: 62.28,
    segments: [
      {
        turnId: 'apf-t1',
        speaker: 'Contador de Histórias',
        voiceName: 'Charon',
        startSec: 0,
        endSec: 15.006,
      },
      {
        turnId: 'apf-t2',
        speaker: 'Mãe Pata',
        voiceName: 'Kore',
        startSec: 15.006,
        endSec: 24.413,
      },
      {
        turnId: 'apf-t3',
        speaker: 'Contador de Histórias',
        voiceName: 'Charon',
        startSec: 24.413,
        endSec: 42.14,
      },
      {
        turnId: 'apf-t4',
        speaker: 'O Jovem Patinho',
        voiceName: 'Puck',
        startSec: 42.48,
        endSec: 52.304,
      },
      {
        turnId: 'apf-t5',
        speaker: 'O Cisne Real',
        voiceName: 'Zephyr',
        startSec: 52.304,
        endSec: 62.28,
      },
    ],
    cacheKey: 'andersen-patinho-feio-mv-bebf3a19a6217735',
    fileSizeBytes: 2989484,
    createdAt: '2026-11-20T01:00:32.183Z',
    audioUrl: '/audio-cache/andersen-patinho-feio-mv-bebf3a19a6217735.wav',
  },
};

export function getStaticCacheInventory(): CacheInventoryResponse {
  const items: CacheSummaryItem[] = Object.values(STATIC_PRERENDERED_AUDIOS).map((item) => ({
    ...item,
    exists: true,
  }));
  const totalSizeBytes = items.reduce((acc, item) => acc + item.fileSizeBytes, 0);
  return {
    items,
    totalSizeBytes,
    count: items.length,
  };
}

export function mergeWithStaticCacheInventory(
  serverInventory?: CacheInventoryResponse | null,
): CacheInventoryResponse {
  const map = new Map<string, CacheSummaryItem>();
  for (const item of Object.values(STATIC_PRERENDERED_AUDIOS)) {
    map.set(item.cacheKey, { ...item, exists: true });
  }
  if (serverInventory?.items) {
    for (const item of serverInventory.items) {
      // Keep static CDN audioUrl if it exists in STATIC_PRERENDERED_AUDIOS
      const staticMatch = STATIC_PRERENDERED_AUDIOS[item.cacheKey];
      map.set(item.cacheKey, staticMatch ? { ...staticMatch, exists: true } : item);
    }
  }
  const items = Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const totalSizeBytes = items.reduce((acc, item) => acc + item.fileSizeBytes, 0);
  return {
    items,
    totalSizeBytes,
    count: items.length,
  };
}
