import type { AudioMimeType, AudioSegmentTiming, PrebuiltVoiceName, ReadingMode } from '../types';

export const MAX_RAW_CHUNK_BYTES = 450_000; // ~600KB base64, safely under Firestore's 1MB doc limit
export const MAX_BASE64_CHUNK_LENGTH = 750_000;
export const MAX_AUDIO_CHUNKS = 60;
export const MAX_TOTAL_WAV_BYTES = 25_000_000;
export const MAX_SEGMENTS = 60;
export const MAX_TITLE_LENGTH = 200;
export const MAX_ID_LENGTH = 128;
export const MAX_BOOK_OR_CHAPTER_ID_LENGTH = 120;
export const MAX_DISPLAY_NAME_LENGTH = 120;
export const MAX_STATIC_URL_LENGTH = 240;
export const MAX_STORAGE_PATH_LENGTH = 240;
export const MAX_DOWNLOAD_URL_LENGTH = 1000;

export const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const CHUNK_ID_PATTERN = /^chunk-[0-9]{3}$/;

export interface EncodedAudioChunk {
  chunkId: string;
  index: number;
  dataBase64: string;
  byteLength: number;
}

export interface PrerenderedAudioWritePayload {
  cacheKey: string;
  chapterId: string;
  bookId: string;
  bookTitle: string;
  chapterTitle: string;
  mode: ReadingMode;
  voiceMap: Record<string, PrebuiltVoiceName>;
  durationSec: number;
  fileSizeBytes: number;
  mimeType: AudioMimeType;
  storageType: 'storage' | 'chunks' | 'static';
  chunkCount: number;
  storagePath?: string;
  downloadUrl?: string;
  staticAudioUrl?: string;
  segments: AudioSegmentTiming[];
  status: 'uploading' | 'ready';
  isPublic: boolean;
  createdByUid: string;
  createdByName: string;
}

export function formatChunkId(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= MAX_AUDIO_CHUNKS) {
    throw new Error(`Índice de bloco de áudio inválido: ${index}`);
  }
  return `chunk-${String(index).padStart(3, '0')}`;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    const slice = bytes.subarray(i, i + step);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Splits a binary WAV buffer into Firestore-safe base64 chunks (<= 450KB raw / <= 600KB base64 each).
 */
export function splitWavIntoFirestoreChunks(
  wavBytes: Uint8Array,
  maxChunkBytes: number = MAX_RAW_CHUNK_BYTES,
): EncodedAudioChunk[] {
  if (wavBytes.byteLength < 44) {
    throw new Error('Arquivo WAV inválido ou menor que o cabeçalho mínimo de 44 bytes.');
  }
  if (wavBytes.byteLength > MAX_TOTAL_WAV_BYTES) {
    throw new Error('Arquivo WAV excede o limite de 25 MB para armazenamento em banco.');
  }

  const chunkSize = Math.max(1024, Math.min(maxChunkBytes, MAX_RAW_CHUNK_BYTES));
  const totalChunks = Math.ceil(wavBytes.byteLength / chunkSize);
  if (totalChunks > MAX_AUDIO_CHUNKS) {
    throw new Error(`Áudio excede o limite máximo de ${MAX_AUDIO_CHUNKS} blocos no banco.`);
  }

  const chunks: EncodedAudioChunk[] = [];
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(wavBytes.byteLength, start + chunkSize);
    const slice = wavBytes.subarray(start, end);
    const dataBase64 = uint8ArrayToBase64(slice);
    if (dataBase64.length > MAX_BASE64_CHUNK_LENGTH) {
      throw new Error('Bloco base64 excedeu o tamanho seguro de documento Firestore.');
    }
    chunks.push({
      chunkId: formatChunkId(i),
      index: i,
      dataBase64,
      byteLength: slice.byteLength,
    });
  }

  return chunks;
}

/**
 * Reassembles sorted Firestore audio chunks back into a single binary WAV Uint8Array.
 */
export function mergeFirestoreChunksToWav(
  chunks: Array<{ index: number; dataBase64: string; byteLength?: number }>,
): Uint8Array {
  if (chunks.length === 0) {
    throw new Error('Nenhum bloco de áudio encontrado no banco de dados.');
  }
  const sorted = [...chunks].sort((a, b) => a.index - b.index);
  const decodedParts: Uint8Array[] = [];
  let totalLength = 0;

  for (let expectedIdx = 0; expectedIdx < sorted.length; expectedIdx++) {
    const chunk = sorted[expectedIdx];
    if (chunk.index !== expectedIdx) {
      throw new Error(`Bloco de áudio ausente na posição ${expectedIdx}.`);
    }
    const bytes = base64ToUint8Array(chunk.dataBase64);
    decodedParts.push(bytes);
    totalLength += bytes.byteLength;
  }

  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of decodedParts) {
    combined.set(part, offset);
    offset += part.byteLength;
  }
  return combined;
}

/**
 * Sanitizes and guarantees that outgoing PrerenderedAudio metadata strictly conforms to
 * firebase-blueprint.json bounds and regex patterns before touching Firestore.
 */
export function sanitizePrerenderedAudioPayload(
  input: PrerenderedAudioWritePayload,
): PrerenderedAudioWritePayload {
  const cleanId = (raw: string, maxLen: number, fallback: string): string => {
    const normalized = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, maxLen);
    return normalized.length >= 2 && SAFE_ID_PATTERN.test(normalized) ? normalized : fallback;
  };

  const cacheKey = cleanId(input.cacheKey, MAX_ID_LENGTH, '');
  if (cacheKey.length < 4) {
    throw new Error('Chave de cache inválida para persistência no banco.');
  }

  const chapterId = cleanId(input.chapterId, MAX_BOOK_OR_CHAPTER_ID_LENGTH, 'conto-01');
  const bookId = cleanId(input.bookId, MAX_BOOK_OR_CHAPTER_ID_LENGTH, 'fabulas-esopo');
  const createdByUid = cleanId(input.createdByUid, MAX_ID_LENGTH, '');
  if (!createdByUid) {
    throw new Error('Identificador do usuário autenticado ausente.');
  }

  const bookTitle = (input.bookTitle || 'Fábulas e Contos').trim().slice(0, MAX_TITLE_LENGTH);
  const chapterTitle = (input.chapterTitle || 'Fábula').trim().slice(0, MAX_TITLE_LENGTH);
  const createdByName = (input.createdByName || 'Curador').trim().slice(0, MAX_DISPLAY_NAME_LENGTH);

  const sanitizedVoiceMap: Record<string, PrebuiltVoiceName> = {};
  const voiceEntries = Object.entries(input.voiceMap ?? {}).slice(0, 16);
  for (const [speaker, voice] of voiceEntries) {
    const cleanSpeaker = speaker.trim().slice(0, 120);
    if (cleanSpeaker) {
      sanitizedVoiceMap[cleanSpeaker] = voice;
    }
  }
  if (Object.keys(sanitizedVoiceMap).length === 0) {
    sanitizedVoiceMap['Contador de Histórias'] = 'Charon';
  }

  const sanitizedSegments: AudioSegmentTiming[] = (input.segments ?? [])
    .slice(0, MAX_SEGMENTS)
    .map((seg, idx) => ({
      turnId: (seg.turnId || `turn-${idx}`).trim().slice(0, 120),
      speaker: (seg.speaker || 'Contador de Histórias').trim().slice(0, 120),
      voiceName: seg.voiceName || 'Charon',
      startSec: Number.isFinite(seg.startSec) && seg.startSec >= 0 ? Number(seg.startSec.toFixed(3)) : 0,
      endSec:
        Number.isFinite(seg.endSec) && seg.endSec > 0
          ? Number(seg.endSec.toFixed(3))
          : Math.max(0.5, Number((seg.startSec || 0).toFixed(3)) + 1),
    }));

  if (sanitizedSegments.length === 0) {
    sanitizedSegments.push({
      turnId: 'turn-0',
      speaker: 'Contador de Histórias',
      voiceName: 'Charon',
      startSec: 0,
      endSec: Math.max(1, Number((input.durationSec || 1).toFixed(3))),
    });
  }

  const durationSec = Math.min(7200, Math.max(0.1, Number(input.durationSec.toFixed(3))));
  const fileSizeBytes = Math.min(
    MAX_TOTAL_WAV_BYTES,
    Math.max(44, Math.round(input.fileSizeBytes)),
  );
  const chunkCount = Math.min(MAX_AUDIO_CHUNKS, Math.max(0, Math.round(input.chunkCount)));

  const mimeType: AudioMimeType = input.mimeType === 'audio/wav' ? 'audio/wav' : 'audio/mpeg';
  const storageType: 'storage' | 'chunks' | 'static' =
    input.storageType === 'static'
      ? 'static'
      : input.storageType === 'storage'
        ? 'storage'
        : 'chunks';

  const result: PrerenderedAudioWritePayload = {
    cacheKey,
    chapterId,
    bookId,
    bookTitle,
    chapterTitle,
    mode: input.mode === 'narrator' ? 'narrator' : 'dramatized',
    voiceMap: sanitizedVoiceMap,
    durationSec,
    fileSizeBytes,
    mimeType,
    storageType,
    chunkCount,
    segments: sanitizedSegments,
    status: input.status === 'ready' ? 'ready' : 'uploading',
    isPublic: Boolean(input.isPublic),
    createdByUid,
    createdByName,
  };

  if (input.storagePath && input.storagePath.trim().length > 0) {
    result.storagePath = input.storagePath.trim().slice(0, MAX_STORAGE_PATH_LENGTH);
  }
  if (input.downloadUrl && input.downloadUrl.trim().length > 0) {
    result.downloadUrl = input.downloadUrl.trim().slice(0, MAX_DOWNLOAD_URL_LENGTH);
  }
  if (input.staticAudioUrl && input.staticAudioUrl.trim().length > 0) {
    result.staticAudioUrl = input.staticAudioUrl.trim().slice(0, MAX_STATIC_URL_LENGTH);
  }

  return result;
}
