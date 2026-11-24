import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHUNK_ID_PATTERN,
  MAX_BASE64_CHUNK_LENGTH,
  formatChunkId,
  mergeFirestoreChunksToWav,
  sanitizePrerenderedAudioPayload,
  splitWavIntoFirestoreChunks,
} from './audioChunks';

test('splitWavIntoFirestoreChunks and mergeFirestoreChunksToWav roundtrip multi-chunk WAV bytes exactly', () => {
  // Build deterministic 120KB pseudo-WAV payload
  const original = new Uint8Array(120_000);
  original.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  for (let i = 4; i < original.length; i++) {
    original[i] = (i * 31 + 17) & 0xff;
  }

  const chunks = splitWavIntoFirestoreChunks(original, 45_000);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].chunkId, 'chunk-000');
  assert.equal(chunks[1].chunkId, 'chunk-001');
  assert.equal(chunks[2].chunkId, 'chunk-002');

  for (const chunk of chunks) {
    assert.match(chunk.chunkId, CHUNK_ID_PATTERN);
    assert.ok(chunk.dataBase64.length <= MAX_BASE64_CHUNK_LENGTH);
  }

  // Merge even if chunks arrive out of order from Firestore
  const restored = mergeFirestoreChunksToWav([chunks[2], chunks[0], chunks[1]]);
  assert.equal(restored.byteLength, original.byteLength);
  assert.deepEqual(restored, original);
});

test('mergeFirestoreChunksToWav throws when a chunk index is missing', () => {
  const wav = new Uint8Array(10_000);
  const chunks = splitWavIntoFirestoreChunks(wav, 3_000);
  assert.throws(() => mergeFirestoreChunksToWav([chunks[0], chunks[2]]), /ausente/i);
});

test('formatChunkId pads indexes and rejects out-of-bounds values', () => {
  assert.equal(formatChunkId(0), 'chunk-000');
  assert.equal(formatChunkId(12), 'chunk-012');
  assert.throws(() => formatChunkId(-1));
  assert.throws(() => formatChunkId(60));
});

test('sanitizePrerenderedAudioPayload truncates strings and enforces blueprint bounds', () => {
  const longTitle = 'A'.repeat(300);
  const sanitized = sanitizePrerenderedAudioPayload({
    cacheKey: 'esopo-cigarra-formiga-mv-aae4b20ec72aa6d1',
    chapterId: 'esopo-cigarra-formiga',
    bookId: 'fabulas-esopo',
    bookTitle: longTitle,
    chapterTitle: longTitle,
    mode: 'dramatized',
    voiceMap: { 'Contador de Histórias': 'Charon', 'A Cigarra': 'Zephyr' },
    durationSec: 87.62456,
    fileSizeBytes: 4205804,
    mimeType: 'audio/wav',
    storageType: 'chunks',
    chunkCount: 10,
    segments: [
      {
        turnId: 'ecf-t1',
        speaker: 'Contador de Histórias',
        voiceName: 'Charon',
        startSec: 0,
        endSec: 23.55,
      },
    ],
    status: 'uploading',
    isPublic: true,
    createdByUid: 'user_abc123',
    createdByName: 'N'.repeat(180),
  });

  assert.equal(sanitized.bookTitle.length, 200);
  assert.equal(sanitized.chapterTitle.length, 200);
  assert.equal(sanitized.createdByName.length, 120);
  assert.equal(sanitized.durationSec, 87.625);
  assert.equal(sanitized.segments.length, 1);
});

test('splitWavIntoFirestoreChunks e mergeFirestoreChunksToWav preservam payload MP3 compactado', () => {
  const sampleMp3 = new Uint8Array(650 * 1024);
  sampleMp3[0] = 0xff;
  sampleMp3[1] = 0xfb;
  sampleMp3[2] = 0x90;
  sampleMp3[3] = 0x64;
  for (let i = 4; i < sampleMp3.length; i += 1) {
    sampleMp3[i] = (i * 17) & 0xff;
  }

  const chunks = splitWavIntoFirestoreChunks(sampleMp3);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0]?.index, 0);
  assert.equal(chunks[1]?.index, 1);

  const restored = mergeFirestoreChunksToWav(chunks);
  assert.equal(restored.byteLength, sampleMp3.byteLength);
  assert.deepEqual(restored, sampleMp3);

  const sanitized = sanitizePrerenderedAudioPayload({
    cacheKey: 'mp3-chunk-test',
    chapterId: 'dom-casmurro-cap-1',
    bookId: 'dom-casmurro',
    bookTitle: 'Dom Casmurro',
    chapterTitle: 'Capítulo I',
    mode: 'dramatized',
    voiceMap: { Narrador: 'Charon' },
    durationSec: 65.4,
    fileSizeBytes: sampleMp3.byteLength,
    mimeType: 'audio/mpeg',
    storageType: 'chunks',
    chunkCount: chunks.length,
    segments: [
      {
        turnId: 'dc-t1',
        speaker: 'Narrador',
        voiceName: 'Charon',
        startSec: 0,
        endSec: 65.4,
      },
    ],
    status: 'ready',
    isPublic: true,
    createdByUid: 'uid-admin',
    createdByName: 'Curador',
  });

  assert.equal(sanitized.mimeType, 'audio/mpeg');
  assert.equal(sanitized.storageType, 'chunks');
  assert.equal(sanitized.chunkCount, 2);
  assert.equal('storagePath' in sanitized, false);
  assert.equal('downloadUrl' in sanitized, false);
});
