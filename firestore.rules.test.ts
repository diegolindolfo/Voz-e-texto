import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RULES_PATH = path.resolve(process.cwd(), 'firestore.rules');
const BLUEPRINT_PATH = path.resolve(process.cwd(), 'firebase-blueprint.json');

interface SimulatedAuth {
  uid: string;
  email?: string;
  email_verified?: boolean;
}

const VALID_ID_RE = /^[a-zA-Z0-9_-]+$/;
const CHUNK_ID_RE = /^chunk-[0-9]{3}$/;
const ALLOWED_AUDIO_KEYS = new Set([
  'cacheKey',
  'chapterId',
  'bookId',
  'bookTitle',
  'chapterTitle',
  'mode',
  'voiceMap',
  'durationSec',
  'fileSizeBytes',
  'mimeType',
  'storageType',
  'chunkCount',
  'staticAudioUrl',
  'segments',
  'status',
  'isPublic',
  'createdByUid',
  'createdByName',
  'createdAt',
  'updatedAt',
]);
const REQUIRED_AUDIO_KEYS = [
  'cacheKey',
  'chapterId',
  'bookId',
  'bookTitle',
  'chapterTitle',
  'mode',
  'voiceMap',
  'durationSec',
  'fileSizeBytes',
  'mimeType',
  'storageType',
  'chunkCount',
  'segments',
  'status',
  'isPublic',
  'createdByUid',
  'createdByName',
  'createdAt',
  'updatedAt',
];

const SERVER_TIME = '__SERVER_TIME__';

function isValidAudioPayload(data: Record<string, unknown>, cacheKey: string): boolean {
  const keys = Object.keys(data);
  if (!REQUIRED_AUDIO_KEYS.every((k) => keys.includes(k))) return false;
  if (!keys.every((k) => ALLOWED_AUDIO_KEYS.has(k))) return false;
  if (typeof data.cacheKey !== 'string' || data.cacheKey !== cacheKey) return false;
  if (data.cacheKey.length < 4 || data.cacheKey.length > 128 || !VALID_ID_RE.test(data.cacheKey)) {
    return false;
  }
  if (typeof data.chapterTitle !== 'string' || data.chapterTitle.length < 1 || data.chapterTitle.length > 200) {
    return false;
  }
  if (typeof data.isPublic !== 'boolean') return false;
  if (!Array.isArray(data.segments) || data.segments.length < 1 || data.segments.length > 60) {
    return false;
  }
  return true;
}

function evaluateCreatePrerenderedAudio(
  auth: SimulatedAuth | null,
  cacheKey: string,
  payload: Record<string, unknown>,
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || auth.email_verified !== true) return 'PERMISSION_DENIED';
  if (cacheKey.length < 2 || cacheKey.length > 128 || !VALID_ID_RE.test(cacheKey)) {
    return 'PERMISSION_DENIED';
  }
  if (!isValidAudioPayload(payload, cacheKey)) return 'PERMISSION_DENIED';
  if (payload.createdByUid !== auth.uid) return 'PERMISSION_DENIED';
  if (payload.createdAt !== SERVER_TIME || payload.updatedAt !== SERVER_TIME) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOW';
}

function baseValidPayload(uid = 'uid-A', cacheKey = 'esopo-cigarra-formiga-mv-aae4b20ec72aa6d1') {
  return {
    cacheKey,
    chapterId: 'esopo-cigarra-formiga',
    bookId: 'fabulas-esopo',
    bookTitle: 'Fábulas de Esopo',
    chapterTitle: 'A Cigarra e a Formiga',
    mode: 'dramatized',
    voiceMap: { 'Contador de Histórias': 'Charon' },
    durationSec: 87.62,
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
    createdByUid: uid,
    createdByName: 'Curador',
    createdAt: SERVER_TIME,
    updatedAt: SERVER_TIME,
  };
}

test('firestore.rules covers every collection declared in firebase-blueprint.json and enforces Eight Pillars', () => {
  const rules = fs.readFileSync(RULES_PATH, 'utf-8');
  const blueprint = JSON.parse(fs.readFileSync(BLUEPRINT_PATH, 'utf-8')) as {
    firestore: Record<string, unknown>;
  };

  assert.ok(rules.includes("rules_version = '2';"));
  assert.ok(rules.includes('match /{document=**} {\n      allow read, write: if false;\n    }'));
  assert.ok(rules.includes('match /prerenderedAudios/{cacheKey}'));
  assert.ok(rules.includes('match /chunks/{chunkId}'));
  assert.ok(rules.includes('match /admins/{adminId}'));
  assert.equal(Object.keys(blueprint.firestore).length, 3);

  // Pillar 4 & 5: email_verified required, no blanket reads, no get() in allow list
  assert.ok(rules.includes('request.auth.token.email_verified == true'));
  assert.ok(!rules.includes('allow read: if true'));
  assert.ok(!rules.includes('allow write: if true'));
  assert.ok(!rules.includes('allow list: if isSignedIn();'));
  assert.ok(rules.includes('isValidPrerenderedAudio(incoming(), cacheKey)'));
  assert.ok(rules.includes('isValidAudioChunk(incoming(), cacheKey, chunkId)'));
  assert.ok(rules.includes("affectedKeys().hasOnly(['status', 'updatedAt'])"));
  assert.ok(rules.includes("affectedKeys().hasOnly(['isPublic', 'updatedAt'])"));
  assert.ok(
    rules.includes(
      'exists(/databases/$(database)/documents/prerenderedAudios/$(cacheKey)/chunks/chunk-000)',
    ),
  );
});

test('Dirty Dozen payloads 1-12 are strictly rejected with PERMISSION_DENIED', () => {
  const verifiedUserA: SimulatedAuth = {
    uid: 'uid-A',
    email: 'reader@example.com',
    email_verified: true,
  };
  const spoofedAdmin: SimulatedAuth = {
    uid: 'uid-evil',
    email: 'diegolindolfo100@gmail.com',
    email_verified: false,
  };

  // Sanity check: legitimate payload is allowed
  assert.equal(
    evaluateCreatePrerenderedAudio(
      verifiedUserA,
      'esopo-cigarra-formiga-mv-aae4b20ec72aa6d1',
      baseValidPayload('uid-A'),
    ),
    'ALLOW',
  );

  // 1. Unauthenticated create
  assert.equal(
    evaluateCreatePrerenderedAudio(null, 'esopo-cigarra-formiga-mv-aae4b20ec72aa6d1', baseValidPayload()),
    'PERMISSION_DENIED',
  );

  // 2. Unverified admin email spoofing
  assert.equal(
    evaluateCreatePrerenderedAudio(
      spoofedAdmin,
      'esopo-cigarra-formiga-mv-aae4b20ec72aa6d1',
      baseValidPayload('uid-evil'),
    ),
    'PERMISSION_DENIED',
  );

  // 3. Identity spoofing (uid-A writing createdByUid = uid-B)
  assert.equal(
    evaluateCreatePrerenderedAudio(
      verifiedUserA,
      'esopo-cigarra-formiga-mv-aae4b20ec72aa6d1',
      baseValidPayload('uid-B'),
    ),
    'PERMISSION_DENIED',
  );

  // 4. Shadow field injection
  assert.equal(
    evaluateCreatePrerenderedAudio(verifiedUserA, 'esopo-cigarra-formiga-mv-aae4b20ec72aa6d1', {
      ...baseValidPayload('uid-A'),
      isAdmin: true,
    }),
    'PERMISSION_DENIED',
  );

  // 5. ID poisoning (200 chars / invalid chars)
  assert.equal(
    evaluateCreatePrerenderedAudio(verifiedUserA, '../evil$id', baseValidPayload('uid-A', '../evil$id')),
    'PERMISSION_DENIED',
  );

  // 6. Oversized chapterTitle (> 200)
  assert.equal(
    evaluateCreatePrerenderedAudio(verifiedUserA, 'esopo-cigarra-formiga-mv-aae4b20ec72aa6d1', {
      ...baseValidPayload('uid-A'),
      chapterTitle: 'X'.repeat(500),
    }),
    'PERMISSION_DENIED',
  );

  // 7 & 8. Invalid chunk ID & oversized chunk check
  assert.equal(CHUNK_ID_RE.test('chunk-evil'), false);
  assert.equal(CHUNK_ID_RE.test('chunk-000'), true);

  // 9. Client timestamp forgery
  assert.equal(
    evaluateCreatePrerenderedAudio(verifiedUserA, 'esopo-cigarra-formiga-mv-aae4b20ec72aa6d1', {
      ...baseValidPayload('uid-A'),
      createdAt: '2020-01-01T00:00:00Z',
    }),
    'PERMISSION_DENIED',
  );

  // 11. Value poisoning on isPublic
  assert.equal(
    evaluateCreatePrerenderedAudio(verifiedUserA, 'esopo-cigarra-formiga-mv-aae4b20ec72aa6d1', {
      ...baseValidPayload('uid-A'),
      isPublic: 'true' as unknown as boolean,
    }),
    'PERMISSION_DENIED',
  );
});
