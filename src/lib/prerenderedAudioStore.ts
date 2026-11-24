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
import type { AudioSegmentTiming, CachedAudioMetadata, PrebuiltVoiceName, ReadingMode } from '../types';
import {
  mergeFirestoreChunksToWav,
  sanitizePrerenderedAudioPayload,
  splitWavIntoFirestoreChunks,
} from './audioChunks';
import { db, handleFirestoreError, OperationType } from './firebase';

const COLLECTION_NAME = 'prerenderedAudios';
const BOOTSTRAPPED_ADMIN_EMAIL = 'diegolindolfo100@gmail.com';

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
  if (user.email === BOOTSTRAPPED_ADMIN_EMAIL) return true;
  return Boolean(record.createdByUid && record.createdByUid === user.uid);
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function mapDocToMetadata(
  id: string,
  data: Record<string, unknown>,
): CachedAudioMetadata | null {
  if (data.status !== 'ready') return null;

  const storageType = data.storageType === 'static' ? 'static' : 'chunks';
  const staticAudioUrl =
    typeof data.staticAudioUrl === 'string' && data.staticAudioUrl.length > 0
      ? data.staticAudioUrl
      : undefined;
  const chunkCount = typeof data.chunkCount === 'number' ? data.chunkCount : 0;

  const audioUrl =
    storageType === 'chunks' && chunkCount > 0
      ? `firestore://${id}`
      : staticAudioUrl || `/api/audio/${id}`;

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
    createdAt: timestampToIso(data.createdAt),
    segments,
    audioUrl,
    storageSource: 'firestore',
    chunkCount,
    createdByUid: typeof data.createdByUid === 'string' ? data.createdByUid : undefined,
    createdByName: typeof data.createdByName === 'string' ? data.createdByName : undefined,
  };
}

/**
 * Subscribes in real time to all public ready pre-rendered audios stored in Firestore.
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
 * Loads all binary chunks for a pre-rendered audio from Firestore and reassembles them into a WAV Blob.
 */
export async function loadWavBlobFromFirestore(cacheKey: string): Promise<Blob> {
  const chunksPath = `${COLLECTION_NAME}/${cacheKey}/chunks`;
  try {
    const q = query(collection(db, COLLECTION_NAME, cacheKey, 'chunks'), where('isPublic', '==', true));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      throw new Error('Blocos de áudio WAV não encontrados no banco de dados.');
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
    const arrayBuffer = wavBytes.buffer.slice(
      wavBytes.byteOffset,
      wavBytes.byteOffset + wavBytes.byteLength,
    ) as ArrayBuffer;
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, chunksPath);
  }
}

/**
 * Deletes a pre-rendered audio document and all of its binary chunks from Firestore.
 */
export async function deletePrerenderedAudioFromFirestore(cacheKey: string): Promise<void> {
  const chunksPath = `${COLLECTION_NAME}/${cacheKey}/chunks`;
  try {
    const q = query(collection(db, COLLECTION_NAME, cacheKey, 'chunks'), where('isPublic', '==', true));
    const chunkSnap = await getDocs(q);
    await Promise.all(
      chunkSnap.docs.map((chunkDoc) => deleteDoc(chunkDoc.ref)),
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, chunksPath);
  }

  const docPath = `${COLLECTION_NAME}/${cacheKey}`;
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, cacheKey));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

/**
 * Persists a complete pre-rendered WAV recording (manifest + chunked binary WAV) into Firestore.
 */
export async function savePrerenderedAudioToFirestore(params: {
  meta: CachedAudioMetadata;
  bookId: string;
  wavBytes: Uint8Array;
  user: User;
  onProgress?: (completedChunks: number, totalChunks: number) => void;
}): Promise<CachedAudioMetadata> {
  const { meta, bookId, wavBytes, user, onProgress } = params;
  if (!user.emailVerified) {
    throw new Error('Sua conta Google precisa ter e-mail verificado para gravar no banco de dados.');
  }

  const chunks = splitWavIntoFirestoreChunks(wavBytes);
  const displayName = (user.displayName || 'Curador Voz & Folha').trim().slice(0, 120);

  const sanitized = sanitizePrerenderedAudioPayload({
    cacheKey: meta.cacheKey,
    chapterId: meta.chapterId,
    bookId,
    bookTitle: meta.bookTitle,
    chapterTitle: meta.chapterTitle,
    mode: meta.mode,
    voiceMap: meta.voiceMap,
    durationSec: meta.durationSec,
    fileSizeBytes: wavBytes.byteLength,
    mimeType: 'audio/wav',
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

  // If already exists, clean up existing doc & chunks before creating fresh copy
  try {
    const existingSnap = await getDoc(parentRef);
    if (existingSnap.exists()) {
      await deletePrerenderedAudioFromFirestore(sanitized.cacheKey);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, parentPath);
  }

  // Step 1: Create parent metadata document with status: 'uploading'
  try {
    await setDoc(parentRef, {
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, parentPath);
  }

  // Step 2: Write all binary WAV chunks sequentially/in small parallel batches
  onProgress?.(0, chunks.length);
  const concurrency = 3;
  let completed = 0;

  for (let i = 0; i < chunks.length; i += concurrency) {
    const slice = chunks.slice(i, i + concurrency);
    await Promise.all(
      slice.map(async (chunk) => {
        const chunkPath = `${COLLECTION_NAME}/${sanitized.cacheKey}/chunks/${chunk.chunkId}`;
        try {
          await setDoc(doc(db, COLLECTION_NAME, sanitized.cacheKey, 'chunks', chunk.chunkId), {
            parentCacheKey: sanitized.cacheKey,
            index: chunk.index,
            dataBase64: chunk.dataBase64,
            byteLength: chunk.byteLength,
            isPublic: sanitized.isPublic,
            createdByUid: user.uid,
            createdAt: serverTimestamp(),
          });
          completed += 1;
          onProgress?.(completed, chunks.length);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, chunkPath);
        }
      }),
    );
  }

  // Step 3: Atomically mark parent record as 'ready' (rules verify chunk-000 exists)
  try {
    await updateDoc(parentRef, {
      status: 'ready',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, parentPath);
  }

  return {
    ...meta,
    cacheKey: sanitized.cacheKey,
    bookId: sanitized.bookId,
    fileSizeBytes: sanitized.fileSizeBytes,
    durationSec: sanitized.durationSec,
    segments: sanitized.segments,
    audioUrl: `firestore://${sanitized.cacheKey}`,
    storageSource: 'firestore',
    chunkCount: chunks.length,
    createdByUid: user.uid,
    createdByName: displayName,
    createdAt: new Date().toISOString(),
  };
}
