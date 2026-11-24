import {
  extractCacheKeyFromFirestoreUrl,
  isFirestoreAudioUrl,
  loadWavBlobFromFirestore,
} from './prerenderedAudioStore';

const CACHE_NAME = 'voz-e-folha-wav-v1';

function toBrowserCacheKey(audioUrl: string): string {
  if (isFirestoreAudioUrl(audioUrl)) {
    const key = extractCacheKeyFromFirestoreUrl(audioUrl);
    return `/firestore-audio/${key}.wav`;
  }
  return audioUrl;
}

/**
 * Fetches a WAV file from the browser Cache API first (offline/instant local cache),
 * falling back to Firestore chunks (`firestore://...`) or HTTP (`/audio-cache/...` or `/api/audio/...`)
 * and caching a local copy for instant zero-read replays.
 */
export async function getPlayableAudioBlobUrl(audioUrl: string): Promise<{
  blobUrl: string;
  fromBrowserCache: boolean;
}> {
  const cacheKeyUrl = toBrowserCacheKey(audioUrl);

  if (typeof window === 'undefined' || !('caches' in window)) {
    if (isFirestoreAudioUrl(audioUrl)) {
      const blob = await loadWavBlobFromFirestore(extractCacheKeyFromFirestoreUrl(audioUrl));
      return { blobUrl: URL.createObjectURL(blob), fromBrowserCache: false };
    }
    return { blobUrl: audioUrl, fromBrowserCache: false };
  }

  try {
    const cache = await window.caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(cacheKeyUrl);
    if (cachedResponse && cachedResponse.ok) {
      const blob = await cachedResponse.blob();
      return { blobUrl: URL.createObjectURL(blob), fromBrowserCache: true };
    }

    if (isFirestoreAudioUrl(audioUrl)) {
      const cacheKey = extractCacheKeyFromFirestoreUrl(audioUrl);
      const blob = await loadWavBlobFromFirestore(cacheKey);
      await cache.put(
        cacheKeyUrl,
        new Response(blob.slice(0), {
          headers: { 'Content-Type': 'audio/wav' },
        }),
      );
      return { blobUrl: URL.createObjectURL(blob), fromBrowserCache: false };
    }

    const networkResponse = await fetch(audioUrl);
    if (!networkResponse.ok) {
      throw new Error('Não foi possível baixar o arquivo WAV em cache.');
    }

    const clone = networkResponse.clone();
    await cache.put(cacheKeyUrl, clone);
    const blob = await networkResponse.blob();
    return { blobUrl: URL.createObjectURL(blob), fromBrowserCache: false };
  } catch (err) {
    if (isFirestoreAudioUrl(audioUrl)) {
      throw err;
    }
    return { blobUrl: audioUrl, fromBrowserCache: false };
  }
}

/**
 * Reads raw WAV bytes from browser Cache API or HTTP URL so they can be persisted into Firestore.
 */
export async function fetchWavBytesForStorage(audioUrl: string): Promise<Uint8Array> {
  if (isFirestoreAudioUrl(audioUrl)) {
    const blob = await loadWavBlobFromFirestore(extractCacheKeyFromFirestoreUrl(audioUrl));
    return new Uint8Array(await blob.arrayBuffer());
  }

  const cacheKeyUrl = toBrowserCacheKey(audioUrl);
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await window.caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(cacheKeyUrl);
      if (cachedResponse && cachedResponse.ok) {
        return new Uint8Array(await cachedResponse.arrayBuffer());
      }
    } catch {
      // Fall through to network fetch
    }
  }

  const res = await fetch(audioUrl);
  if (!res.ok) {
    throw new Error('Não foi possível obter os bytes do arquivo WAV para salvar no banco.');
  }
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Triggers a clean browser download for both HTTP and Firestore-stored WAV files.
 */
export async function downloadWavFile(audioUrl: string, filename: string): Promise<void> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const { blobUrl } = await getPlayableAudioBlobUrl(audioUrl);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = safeName.endsWith('.wav') ? safeName : `${safeName}.wav`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (blobUrl.startsWith('blob:')) {
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
  }
}

export async function evictBrowserAudioCache(audioUrl: string): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cache = await window.caches.open(CACHE_NAME);
    await cache.delete(toBrowserCacheKey(audioUrl));
    await cache.delete(audioUrl);
  } catch {
    // Ignore storage errors in restricted contexts
  }
}
