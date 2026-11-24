import {
  extractCacheKeyFromFirestoreUrl,
  isFirestoreAudioUrl,
  loadWavBlobFromFirestore,
} from './prerenderedAudioStore';

const CACHE_NAME = 'voz-e-folha-audio-v2';

function toBrowserCacheKey(audioUrl: string): string {
  if (isFirestoreAudioUrl(audioUrl)) {
    const key = extractCacheKeyFromFirestoreUrl(audioUrl);
    return `/firestore-audio/${key}.wav`;
  }
  return audioUrl;
}

function inferContentType(audioUrl: string, mimeType?: string): string {
  if (mimeType === 'audio/wav' || /\.wav(\?|$)/i.test(audioUrl) || isFirestoreAudioUrl(audioUrl)) {
    return 'audio/wav';
  }
  return 'audio/mpeg';
}

/**
 * Fetches an audio file (MP3 or WAV) from the browser Cache API first (offline/instant local cache),
 * falling back to Firebase Storage HTTPS URL, legacy Firestore chunks (`firestore://...`),
 * or HTTP (`/audio-cache/...` or `/api/audio/...`) and caching a local copy for instant replays.
 */
export async function getPlayableAudioBlobUrl(
  audioUrl: string,
  mimeType?: string,
): Promise<{
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
          headers: { 'Content-Type': inferContentType(audioUrl, mimeType) },
        }),
      );
      return { blobUrl: URL.createObjectURL(blob), fromBrowserCache: false };
    }

    const networkResponse = await fetch(audioUrl);
    if (!networkResponse.ok) {
      throw new Error('Não foi possível baixar o arquivo de áudio em cache.');
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
 * Reads raw audio bytes from browser Cache API or HTTP URL so they can be uploaded to Firebase Storage.
 */
export async function fetchAudioBytesForStorage(audioUrl: string): Promise<Uint8Array> {
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
    throw new Error('Não foi possível obter os bytes do arquivo de áudio para salvar na nuvem.');
  }
  return new Uint8Array(await res.arrayBuffer());
}

export const fetchWavBytesForStorage = fetchAudioBytesForStorage;

/**
 * Triggers a clean browser download for HTTP, Firebase Storage, and legacy Firestore audio files.
 */
export async function downloadAudioFile(
  audioUrl: string,
  filename: string,
  mimeType?: string,
): Promise<void> {
  const safeBase = filename.replace(/\.(mp3|wav)$/i, '').replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = inferContentType(audioUrl, mimeType) === 'audio/wav' ? 'wav' : 'mp3';
  const { blobUrl } = await getPlayableAudioBlobUrl(audioUrl, mimeType);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `${safeBase}.${ext}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (blobUrl.startsWith('blob:')) {
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
  }
}

export const downloadWavFile = downloadAudioFile;

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
