import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import type {
  AudioMimeType,
  AudioSegmentTiming,
  CachedAudioMetadata,
  PrebuiltVoiceName,
  ReadingMode,
} from '../types';
import {
  mergeFirestoreChunksToWav,
  sanitizePrerenderedAudioPayload,
  splitWavIntoFirestoreChunks,
} from './audioChunks';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
  storage,
} from './firebase';

const COLLECTION_NAME = 'prerenderedAudios';

export function isFirestoreAudioUrl(audioUrl: string): boolean {
  return audioUrl.startsWith('firestore://');
}

export function extractCacheKeyFromFirestoreUrl(audioUrl: string): string {
  return audioUrl.replace(/^firestore:\/\//, '').trim();
}

export function canUserDeleteFirestoreRecord(
  record: CachedAudioMetadata,
  user: User | null,
): boolean {
  if (!user || !user.emailVerified) return false;
  if (user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL) return true;
  return Boolean(record.createdByUid && record.createdByUid === user.uid);
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function detectMimeType(audioBytes: Uint8Array, hint?: AudioMimeType): AudioMimeType {
  if (
    audioBytes.byteLength >= 12 &&
    audioBytes[0] === 0x52 &&
    audioBytes[1] === 0x49 &&
    audioBytes[2] === 0x46 &&
    audioBytes[3] === 0x46
  ) {
    return 'audio/wav';
  }
  return hint === 'audio/wav' ? 'audio/wav' : 'audio/mpeg';
}

function mapDocToMetadata(
  id: string,
  data: Record<string, unknown>,
): CachedAudioMetadata | null {
  if (data.status !== 'ready') return null;

  const storageType =
    data.storageType === 'storage'
      ? 'storage'
      : data.storageType === 'static'
        ? 'static'
        : 'chunks';
  const staticAudioUrl =
    typeof data.staticAudioUrl === 'string' && data.staticAudioUrl.length > 0
      ? data.staticAudioUrl
      : undefined;
  const downloadUrl =
    typeof data.downloadUrl === 'string' && data.downloadUrl.startsWith('https://')
      ? data.downloadUrl
      : undefined;
  const storagePath =
    typeof data.storagePath === 'string' && data.storagePath.length > 0
      ? data.storagePath
      : undefined;
  const chunkCount = typeof data.chunkCount === 'number' ? data.chunkCount : 0;
  const mimeType: AudioMimeType = data.mimeType === 'audio/wav' ? 'audio/wav' : 'audio/mpeg';

  let audioUrl = staticAudioUrl || `/api/audio/${id}`;
  let storageSource: CachedAudioMetadata['storageSource'] = staticAudioUrl
    ? 'static'
    : 'local-server';

  if (storageType === 'storage' && downloadUrl) {
    audioUrl = downloadUrl;
    storageSource = 'firebase-storage';
  } else if (storageType === 'chunks' && chunkCount > 0) {
    audioUrl = `firestore://${id}`;
    storageSource = 'firestore';
  }

  const segments = Array.isArray(data.segments)
    ? (data.segments as AudioSegmentTiming[])
    : [];

  return {
    cacheKey: typeof data.cacheKey === 'string' ? data.cacheKey : id,
    chapterId: typeof data.chapterId === 'string' ? data.chapterId : '',
    bookId: typeof data.bookId === 'string' ? data.bookId : undefined,
    bookTitle: typeof data.bookTitle === 'string' ? data.bookTitle : 'Fábulas e Contos',
    chapterTitle: typeof data.chapterTitle === 'string' ? data.chapterTitle : 'Fábula',
    mode: (data.mode === 'narrator' ? 'narrator' : 'dramatized') as ReadingMode,
    voiceMap: (data.voiceMap as Record<string, PrebuiltVoiceName>) ?? {},
    durationSec: typeof data.durationSec === 'number' ? data.durationSec : 0,
    fileSizeBytes: typeof data.fileSizeBytes === 'number' ? data.fileSizeBytes : 0,
    mimeType,
    createdAt: timestampToIso(data.createdAt),
    segments,
    audioUrl,
    storageSource,
    storagePath,
    downloadUrl,
    chunkCount,
    createdByUid: typeof data.createdByUid === 'string' ? data.createdByUid : undefined,
    createdByName: typeof data.createdByName === 'string' ? data.createdByName : undefined,
  };
}

/**
 * Subscribes in real time to all public ready pre-rendered audios cataloged in Firestore.
 */
export function subscribeToPrerenderedAudios(
  onUpdate: (items: CachedAudioMetadata[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const path = COLLECTION_NAME;
  const q = query(collection(db, path), where('isPublic', '==', true));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: CachedAudioMetadata[] = [];
      for (const docSnap of snapshot.docs) {
        const mapped = mapDocToMetadata(docSnap.id, docSnap.data() as Record<string, unknown>);
        if (mapped) {
          items.push(mapped);
        }
      }
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onUpdate(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

/**
 * Loads legacy binary chunks from Firestore and reassembles them into a WAV Blob.
 */
export async function loadWavBlobFromFirestore(cacheKey: string): Promise<Blob> {
  const chunksPath = `${COLLECTION_NAME}/${cacheKey}/chunks`;
  try {
    const q = query(
      collection(db, COLLECTION_NAME, cacheKey, 'chunks'),
      where('isPublic', '==', true),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      throw new Error('Blocos de áudio não encontrados no banco de dados.');
    }

    const rawChunks = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as {
        index: number;
        dataBase64: string;
        byteLength?: number;
      };
      return {
        index: data.index,
        dataBase64: data.dataBase64,
        byteLength: data.byteLength,
      };
    });

    const wavBytes = mergeFirestoreChunksToWav(rawChunks);
    const detectedMime = detectMimeType(wavBytes);
    const arrayBuffer = wavBytes.buffer.slice(
      wavBytes.byteOffset,
      wavBytes.byteOffset + wavBytes.byteLength,
    ) as ArrayBuffer;
    return new Blob([arrayBuffer], { type: detectedMime });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, chunksPath);
  }
}

export const loadAudioBlobFromFirestore = loadWavBlobFromFirestore;

/**
 * Deletes a pre-rendered audio catalog document and its Firebase Storage object (or legacy chunks).
 */
export async function deletePrerenderedAudioFromFirestore(cacheKey: string): Promise<void> {
  const parentRef = doc(db, COLLECTION_NAME, cacheKey);
  const docPath = `${COLLECTION_NAME}/${cacheKey}`;

  let existingData: Record<string, unknown> | null = null;
  try {
    const parentSnap = await getDoc(parentRef);
    if (parentSnap.exists()) {
      existingData = parentSnap.data() as Record<string, unknown>;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }

  if (existingData && typeof existingData.storagePath === 'string' && existingData.storagePath) {
    try {
      await deleteObject(ref(storage, existingData.storagePath));
    } catch (storageErr) {
      const code = (storageErr as { code?: string })?.code ?? '';
      if (!code.includes('object-not-found')) {
        console.warn('Firebase Storage delete notice:', storageErr);
      }
    }
  }

  if (!existingData || existingData.storageType === 'chunks') {
    const chunksPath = `${COLLECTION_NAME}/${cacheKey}/chunks`;
    try {
      const q = query(
        collection(db, COLLECTION_NAME, cacheKey, 'chunks'),
        where('isPublic', '==', true),
      );
      const chunkSnap = await getDocs(q);
      if (!chunkSnap.empty) {
        await Promise.all(chunkSnap.docs.map((chunkDoc) => deleteDoc(chunkDoc.ref)));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, chunksPath);
    }
  }

  try {
    await deleteDoc(parentRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

/**
 * Splits a pre-rendered MP3/WAV audio binary into Firestore-safe chunks and saves it to Cloud Firestore (Spark Free compatible).
 */
export async function savePrerenderedAudioToFirestore(params: {
  meta: CachedAudioMetadata;
  bookId: string;
  wavBytes: Uint8Array;
  user: User;
  onProgress?: (completedPercent: number, totalPercent: number) => void;
}): Promise<CachedAudioMetadata> {
  const { meta, bookId, wavBytes: audioBytes, user, onProgress } = params;
  if (!user.emailVerified) {
    throw new Error('Sua conta Google precisa ter e-mail verificado para gravar na nuvem.');
  }

  const mimeType = detectMimeType(audioBytes, meta.mimeType);
  const displayName = (user.displayName || 'Curador Voz & Folha').trim().slice(0, 120);
  const chunks = splitWavIntoFirestoreChunks(audioBytes);

  const sanitized = sanitizePrerenderedAudioPayload({
    cacheKey: meta.cacheKey,
    chapterId: meta.chapterId,
    bookId,
    bookTitle: meta.bookTitle,
    chapterTitle: meta.chapterTitle,
    mode: meta.mode,
    voiceMap: meta.voiceMap,
    durationSec: meta.durationSec,
    fileSizeBytes: audioBytes.byteLength,
    mimeType,
    storageType: 'chunks',
    chunkCount: chunks.length,
    segments: meta.segments,
    status: 'uploading',
    isPublic: true,
    createdByUid: user.uid,
    createdByName: displayName,
  });

  const parentRef = doc(db, COLLECTION_NAME, sanitized.cacheKey);
  const parentPath = `${COLLECTION_NAME}/${sanitized.cacheKey}`;

  onProgress?.(0, 100);

  try {
    const existingSnap = await getDoc(parentRef);
    if (existingSnap.exists()) {
      await deletePrerenderedAudioFromFirestore(sanitized.cacheKey);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, parentPath);
  }

  try {
    await setDoc(parentRef, {
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, parentPath);
  }

  let completed = 0;
  const CONCURRENCY = 3;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const batch = chunks.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (chunk) => {
        const chunkId = `chunk-${String(chunk.index).padStart(3, '0')}`;
        const chunkRef = doc(db, COLLECTION_NAME, sanitized.cacheKey, 'chunks', chunkId);
        const chunkPath = `${parentPath}/chunks/${chunkId}`;
        try {
          await setDoc(chunkRef, {
            parentCacheKey: sanitized.cacheKey,
            index: chunk.index,
            dataBase64: chunk.dataBase64,
            byteLength: chunk.byteLength,
            isPublic: sanitized.isPublic,
            createdByUid: user.uid,
            createdAt: serverTimestamp(),
          });
          completed += 1;
          onProgress?.(Math.min(99, Math.round((completed / chunks.length) * 100)), 100);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, chunkPath);
        }
      }),
    );
  }

  try {
    await updateDoc(parentRef, {
      status: 'ready',
      updatedAt: serverTimestamp(),
    });
    onProgress?.(100, 100);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, parentPath);
  }

  return {
    ...meta,
    cacheKey: sanitized.cacheKey,
    bookId: sanitized.bookId,
    fileSizeBytes: sanitized.fileSizeBytes,
    durationSec: sanitized.durationSec,
    mimeType,
    segments: sanitized.segments,
    audioUrl: `firestore://${sanitized.cacheKey}`,
    storageSource: 'firestore',
    chunkCount: chunks.length,
    createdByUid: user.uid,
    createdByName: displayName,
    createdAt: new Date().toISOString(),
  };
}

export const savePrerenderedAudioToCloud = savePrerenderedAudioToFirestore;
