const CACHE_NAME = 'voz-e-folha-wav-v1';

/**
 * Fetches a WAV file from the browser Cache API first (offline/instant local cache),
 * falling back to the server's cached `/api/audio/:cacheKey` endpoint and storing a copy locally.
 */
export async function getPlayableAudioBlobUrl(audioUrl: string): Promise<{
  blobUrl: string;
  fromBrowserCache: boolean;
}> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return { blobUrl: audioUrl, fromBrowserCache: false };
  }

  try {
    const cache = await window.caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(audioUrl);
    if (cachedResponse && cachedResponse.ok) {
      const blob = await cachedResponse.blob();
      return { blobUrl: URL.createObjectURL(blob), fromBrowserCache: true };
    }

    const networkResponse = await fetch(audioUrl);
    if (!networkResponse.ok) {
      throw new Error('Não foi possível baixar o arquivo WAV em cache.');
    }

    const clone = networkResponse.clone();
    await cache.put(audioUrl, clone);
    const blob = await networkResponse.blob();
    return { blobUrl: URL.createObjectURL(blob), fromBrowserCache: false };
  } catch {
    return { blobUrl: audioUrl, fromBrowserCache: false };
  }
}

export async function evictBrowserAudioCache(audioUrl: string): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cache = await window.caches.open(CACHE_NAME);
    await cache.delete(audioUrl);
  } catch {
    // Ignore storage errors in restricted contexts
  }
}
