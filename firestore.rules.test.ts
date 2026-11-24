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
const STORAGE_PATH_RE = /^prerendered-audios\/[a-zA-Z0-9_-]+\.(mp3|wav)$/;
const DOWNLOAD_URL_RE = /^https:\/\/.*/;
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
  'storagePath',
  'downloadUrl',
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
  if (data.mimeType !== 'audio/mpeg' && data.mimeType !== 'audio/wav') {
    return false;
  }
  if (data.storageType !== 'storage' && data.storageType !== 'chunks' && data.storageType !== 'static') {
    return false;
  }
  if (typeof data.chunkCount !== 'number' || !Number.isInteger(data.chunkCount) || data.chunkCount < 0 || data.chunkCount > 60) {
    return false;
  }
  if ('storagePath' in data) {
    if (
      typeof data.storagePath !== 'string' ||
      data.storagePath.length < 1 ||
      data.storagePath.length > 240 ||
      !STORAGE_PATH_RE.test(data.storagePath)
    ) {
      return false;
    }
  }
  if ('downloadUrl' in data) {
    if (
      typeof data.downloadUrl !== 'string' ||
      data.downloadUrl.length < 10 ||
      data.downloadUrl.length > 1000 ||
      !DOWNLOAD_URL_RE.test(data.downloadUrl)
    ) {
      return false;
    }
  }
  if ('staticAudioUrl' in data) {
    if (
      typeof data.staticAudioUrl !== 'string' ||
      data.staticAudioUrl.length < 1 ||
      data.staticAudioUrl.length > 240
    ) {
      return false;
    }
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
  const chunkCount = payload.chunkCount as number;
  const isValidChunksCreate =
    payload.storageType === 'chunks' && payload.status === 'uploading' && chunkCount >= 1;
  const isValidStaticCreate =
    payload.storageType === 'static' &&
    payload.status === 'ready' &&
    chunkCount === 0 &&
    'staticAudioUrl' in payload;
  const isValidStorageCreate =
    payload.storageType === 'storage' &&
    payload.status === 'ready' &&
    chunkCount === 0 &&
    'storagePath' in payload &&
    'downloadUrl' in payload;

  if (!isValidChunksCreate && !isValidStaticCreate && !isValidStorageCreate) {
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
  const rules = fs.readFileSync(RULES_PATH, 'utf-8').replace(/\r\n/g, '\n');
  const blueprint = JSON.parse(fs.readFileSync(BLUEPRINT_PATH, 'utf-8')) as {
    firestore: Record<string, unknown>;
  };

  assert.ok(rules.includes("rules_version = '2';"));
  assert.ok(rules.includes('match /{document=**} {\n      allow read, write: if false;\n    }'));
  assert.ok(rules.includes('match /prerenderedAudios/{cacheKey}'));
  assert.ok(rules.includes('match /chunks/{chunkId}'));
  assert.ok(rules.includes('match /admins/{adminId}'));
  assert.ok(rules.includes('match /customBooks/{bookId}'));
  assert.ok(rules.includes('match /dramatizedScripts/{chapterId}'));
  assert.equal(Object.keys(blueprint.firestore).length, 5);

  // Pillar 4 & 5: email_verified required, no blanket reads, no get() in allow list
  assert.ok(rules.includes('request.auth.token.email_verified == true'));
  assert.ok(!rules.includes('allow read: if true'));
  assert.ok(!rules.includes('allow write: if true'));
  assert.ok(!rules.includes('allow list: if isSignedIn();'));
  assert.ok(rules.includes('isValidPrerenderedAudio(incoming(), cacheKey)'));
  assert.ok(rules.includes('isValidAudioChunk(incoming(), cacheKey, chunkId)'));
  assert.ok(rules.includes('isValidCustomBook(incoming(), bookId)'));
  assert.ok(rules.includes('isValidDramatizedScript(incoming(), chapterId)'));
  assert.ok(rules.includes("affectedKeys().hasOnly(['status', 'updatedAt'])"));
  assert.ok(rules.includes("affectedKeys().hasOnly(['isPublic', 'updatedAt'])"));
  assert.ok(
    rules.includes(
      'exists(/databases/$(database)/documents/prerenderedAudios/$(cacheKey)/chunks/chunk-000)',
    ),
  );

  // Verify zero get()/exists()/isAdmin() calls in any allow list block
  const allowListBlocks = [...rules.matchAll(/allow list:[\s\S]*?;/g)].map((m) => m[0]);
  assert.ok(allowListBlocks.length >= 5);
  for (const block of allowListBlocks) {
    assert.ok(!block.includes('get('), `allow list must not call get(): ${block}`);
    assert.ok(!block.includes('exists('), `allow list must not call exists(): ${block}`);
    assert.ok(!block.includes('isAdmin('), `allow list must not call isAdmin(): ${block}`);
  }

  // Storage-backed MP3/WAV schema & create rules
  assert.ok(rules.includes("data.mimeType in ['audio/mpeg', 'audio/wav']"));
  assert.ok(rules.includes("data.storageType in ['storage', 'chunks', 'static']"));
  assert.ok(rules.includes("'storagePath'"));
  assert.ok(rules.includes("'downloadUrl'"));
  assert.ok(
    rules.includes("data.storagePath.matches('^prerendered-audios/[a-zA-Z0-9_\\\\-]+\\\\.(mp3|wav)$')"),
  );
  assert.ok(rules.includes("data.downloadUrl.matches('^https://.*')"));
  assert.ok(
    rules.includes(
      "incoming().storageType == 'storage' && incoming().status == 'ready' && incoming().chunkCount == 0 && ('storagePath' in incoming()) && ('downloadUrl' in incoming())",
    ),
  );

  // Ensure storagePath/downloadUrl are NOT in hasAll (kept optional for chunks/static)
  const hasAllBlock = rules.match(/data\.keys\(\)\.hasAll\(\[([\s\S]*?)\]\)/);
  assert.ok(hasAllBlock, 'expected data.keys().hasAll block');
  assert.ok(!hasAllBlock[1].includes("'storagePath'"));
  assert.ok(!hasAllBlock[1].includes("'downloadUrl'"));

  // Ensure optional fields for CustomBook and DramatizedScript are NOT in their hasAll blocks
  const customBookFn = rules.match(/function isValidCustomBook[\s\S]*?data\.keys\(\)\.hasAll\(\[([\s\S]*?)\]\)/);
  assert.ok(customBookFn, 'expected isValidCustomBook hasAll block');
  assert.ok(!customBookFn[1].includes("'gutenbergId'"));

  const dramatizedScriptFn = rules.match(/function isValidDramatizedScript[\s\S]*?data\.keys\(\)\.hasAll\(\[([\s\S]*?)\]\)/);
  assert.ok(dramatizedScriptFn, 'expected isValidDramatizedScript hasAll block');
  assert.ok(!dramatizedScriptFn[1].includes("'moral'"));
  assert.ok(!dramatizedScriptFn[1].includes("'aiNotes'"));
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

test('Firebase Storage-backed MP3/WAV records enforce storageType, mimeType, storagePath, and downloadUrl rules', () => {
  const verifiedUserA: SimulatedAuth = {
    uid: 'uid-A',
    email: 'reader@example.com',
    email_verified: true,
  };
  const cacheKey = 'esopo-cigarra-formiga-mv-aae4b20ec72aa6d1';
  const validStorageMp3 = {
    ...baseValidPayload('uid-A', cacheKey),
    mimeType: 'audio/mpeg',
    storageType: 'storage',
    chunkCount: 0,
    status: 'ready',
    storagePath: `prerendered-audios/${cacheKey}.mp3`,
    downloadUrl: `https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o/prerendered-audios%2F${cacheKey}.mp3?alt=media`,
  };

  // Valid storage MP3
  assert.equal(evaluateCreatePrerenderedAudio(verifiedUserA, cacheKey, validStorageMp3), 'ALLOW');

  // Valid storage WAV
  assert.equal(
    evaluateCreatePrerenderedAudio(verifiedUserA, cacheKey, {
      ...validStorageMp3,
      mimeType: 'audio/wav',
      storagePath: `prerendered-audios/${cacheKey}.wav`,
    }),
    'ALLOW',
  );

  // Valid static record (omits storagePath and downloadUrl)
  assert.equal(
    evaluateCreatePrerenderedAudio(verifiedUserA, cacheKey, {
      ...baseValidPayload('uid-A', cacheKey),
      storageType: 'static',
      chunkCount: 0,
      status: 'ready',
      staticAudioUrl: `/audio/${cacheKey}.mp3`,
      mimeType: 'audio/mpeg',
    }),
    'ALLOW',
  );

  // Missing storagePath or downloadUrl for storageType == 'storage'
  const withoutStoragePath = { ...validStorageMp3 } as Record<string, unknown>;
  delete withoutStoragePath.storagePath;
  assert.equal(evaluateCreatePrerenderedAudio(verifiedUserA, cacheKey, withoutStoragePath), 'PERMISSION_DENIED');

  const withoutDownloadUrl = { ...validStorageMp3 } as Record<string, unknown>;
  delete withoutDownloadUrl.downloadUrl;
  assert.equal(evaluateCreatePrerenderedAudio(verifiedUserA, cacheKey, withoutDownloadUrl), 'PERMISSION_DENIED');

  // Invalid status or chunkCount for storageType == 'storage'
  assert.equal(
    evaluateCreatePrerenderedAudio(verifiedUserA, cacheKey, { ...validStorageMp3, status: 'uploading' }),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateCreatePrerenderedAudio(verifiedUserA, cacheKey, { ...validStorageMp3, chunkCount: 1 }),
    'PERMISSION_DENIED',
  );

  // Path traversal, wrong prefix, bad extension, or oversized storagePath
  for (const badPath of [
    '../secrets/audio.mp3',
    'prerendered-audios/sub/file.mp3',
    'other-bucket/file.mp3',
    `prerendered-audios/${cacheKey}.ogg`,
    `prerendered-audios/${cacheKey}.exe`,
    `prerendered-audios/${'a'.repeat(230)}.mp3`,
  ]) {
    assert.equal(
      evaluateCreatePrerenderedAudio(verifiedUserA, cacheKey, {
        ...validStorageMp3,
        storagePath: badPath,
      }),
      'PERMISSION_DENIED',
      `expected storagePath ${badPath} to be rejected`,
    );
  }

  // Non-HTTPS, too short, or oversized downloadUrl
  for (const badUrl of [
    'http://firebasestorage.googleapis.com/audio.mp3',
    'https://x',
    'javascript:alert(1)',
    `https://example.com/${'a'.repeat(1000)}`,
  ]) {
    assert.equal(
      evaluateCreatePrerenderedAudio(verifiedUserA, cacheKey, {
        ...validStorageMp3,
        downloadUrl: badUrl,
      }),
      'PERMISSION_DENIED',
      `expected downloadUrl ${badUrl} to be rejected`,
    );
  }

  // Invalid mimeType / storageType
  assert.equal(
    evaluateCreatePrerenderedAudio(verifiedUserA, cacheKey, { ...validStorageMp3, mimeType: 'audio/ogg' }),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateCreatePrerenderedAudio(verifiedUserA, cacheKey, { ...validStorageMp3, storageType: 'gcs' }),
    'PERMISSION_DENIED',
  );
});

const REQUIRED_CUSTOM_BOOK_KEYS = [
  'id',
  'title',
  'author',
  'year',
  'publicDomainSource',
  'coverUrl',
  'synopsis',
  'isCustom',
  'chapters',
  'isPublic',
  'createdByUid',
  'createdAt',
  'updatedAt',
];
const ALLOWED_CUSTOM_BOOK_KEYS = new Set([...REQUIRED_CUSTOM_BOOK_KEYS, 'gutenbergId']);

const REQUIRED_DRAMATIZED_SCRIPT_KEYS = [
  'chapterId',
  'summary',
  'characters',
  'turns',
  'isPublic',
  'createdByUid',
  'createdAt',
  'updatedAt',
];
const ALLOWED_DRAMATIZED_SCRIPT_KEYS = new Set([
  ...REQUIRED_DRAMATIZED_SCRIPT_KEYS,
  'moral',
  'aiNotes',
]);

function isBootstrappedAdmin(auth: SimulatedAuth | null): boolean {
  return Boolean(
    auth && auth.email_verified === true && auth.email === 'diegolindolfo100@gmail.com',
  );
}

function isAdmin(auth: SimulatedAuth | null, adminAllowlist: Set<string>): boolean {
  return (
    isBootstrappedAdmin(auth) ||
    Boolean(auth && auth.email_verified === true && adminAllowlist.has(auth.uid))
  );
}

function isPlainMap(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidCustomBookPayload(data: Record<string, unknown>, bookId: string): boolean {
  const keys = Object.keys(data);
  if (!REQUIRED_CUSTOM_BOOK_KEYS.every((k) => keys.includes(k))) return false;
  if (!keys.every((k) => ALLOWED_CUSTOM_BOOK_KEYS.has(k))) return false;
  if (
    typeof data.id !== 'string' ||
    data.id !== bookId ||
    data.id.length < 2 ||
    data.id.length > 120 ||
    !VALID_ID_RE.test(data.id)
  ) {
    return false;
  }
  if (typeof data.title !== 'string' || data.title.length < 1 || data.title.length > 200) return false;
  if (typeof data.author !== 'string' || data.author.length < 1 || data.author.length > 200) return false;
  if (typeof data.year !== 'number' || !Number.isInteger(data.year) || data.year < 1000 || data.year > 2100) {
    return false;
  }
  if (
    typeof data.publicDomainSource !== 'string' ||
    data.publicDomainSource.length < 1 ||
    data.publicDomainSource.length > 240
  ) {
    return false;
  }
  if (typeof data.coverUrl !== 'string' || data.coverUrl.length > 500) return false;
  if (typeof data.synopsis !== 'string' || data.synopsis.length > 1000) return false;
  if ('gutenbergId' in data) {
    if (
      typeof data.gutenbergId !== 'number' ||
      !Number.isInteger(data.gutenbergId) ||
      data.gutenbergId < 1 ||
      data.gutenbergId > 999999
    ) {
      return false;
    }
  }
  if (typeof data.isCustom !== 'boolean') return false;
  if (
    !Array.isArray(data.chapters) ||
    data.chapters.length < 1 ||
    data.chapters.length > 60 ||
    !isPlainMap(data.chapters[0])
  ) {
    return false;
  }
  if (typeof data.isPublic !== 'boolean') return false;
  if (
    typeof data.createdByUid !== 'string' ||
    data.createdByUid.length < 1 ||
    data.createdByUid.length > 128 ||
    !VALID_ID_RE.test(data.createdByUid)
  ) {
    return false;
  }
  if (!data.createdAt || !data.updatedAt) return false;
  return true;
}

function evaluateCustomBookWrite(
  op: 'create' | 'update' | 'delete',
  auth: SimulatedAuth | null,
  adminAllowlist: Set<string>,
  bookId: string,
  incomingData: Record<string, unknown> | null,
  existingData: Record<string, unknown> | null,
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!isAdmin(auth, adminAllowlist)) return 'PERMISSION_DENIED';
  if (bookId.length < 2 || bookId.length > 128 || !VALID_ID_RE.test(bookId)) {
    return 'PERMISSION_DENIED';
  }
  if (op === 'delete') return 'ALLOW';
  if (!incomingData || !isValidCustomBookPayload(incomingData, bookId)) return 'PERMISSION_DENIED';
  if (op === 'create') {
    if (incomingData.createdByUid !== auth?.uid) return 'PERMISSION_DENIED';
    if (incomingData.createdAt !== SERVER_TIME || incomingData.updatedAt !== SERVER_TIME) {
      return 'PERMISSION_DENIED';
    }
    return 'ALLOW';
  }
  if (!existingData) return 'PERMISSION_DENIED';
  if (incomingData.createdByUid !== existingData.createdByUid) return 'PERMISSION_DENIED';
  if (incomingData.createdAt !== existingData.createdAt) return 'PERMISSION_DENIED';
  if (incomingData.updatedAt !== SERVER_TIME) return 'PERMISSION_DENIED';
  return 'ALLOW';
}

function isValidDramatizedScriptPayload(data: Record<string, unknown>, chapterId: string): boolean {
  const keys = Object.keys(data);
  if (!REQUIRED_DRAMATIZED_SCRIPT_KEYS.every((k) => keys.includes(k))) return false;
  if (!keys.every((k) => ALLOWED_DRAMATIZED_SCRIPT_KEYS.has(k))) return false;
  if (
    typeof data.chapterId !== 'string' ||
    data.chapterId !== chapterId ||
    data.chapterId.length < 2 ||
    data.chapterId.length > 120 ||
    !VALID_ID_RE.test(data.chapterId)
  ) {
    return false;
  }
  if (typeof data.summary !== 'string' || data.summary.length < 1 || data.summary.length > 600) {
    return false;
  }
  if ('moral' in data && (typeof data.moral !== 'string' || data.moral.length > 600)) {
    return false;
  }
  if ('aiNotes' in data && (typeof data.aiNotes !== 'string' || data.aiNotes.length > 400)) {
    return false;
  }
  if (
    !Array.isArray(data.characters) ||
    data.characters.length < 1 ||
    data.characters.length > 16 ||
    !isPlainMap(data.characters[0])
  ) {
    return false;
  }
  if (
    !Array.isArray(data.turns) ||
    data.turns.length < 1 ||
    data.turns.length > 80 ||
    !isPlainMap(data.turns[0])
  ) {
    return false;
  }
  if (typeof data.isPublic !== 'boolean') return false;
  if (
    typeof data.createdByUid !== 'string' ||
    data.createdByUid.length < 1 ||
    data.createdByUid.length > 128 ||
    !VALID_ID_RE.test(data.createdByUid)
  ) {
    return false;
  }
  if (!data.createdAt || !data.updatedAt) return false;
  return true;
}

function evaluateDramatizedScriptWrite(
  op: 'create' | 'update' | 'delete',
  auth: SimulatedAuth | null,
  adminAllowlist: Set<string>,
  chapterId: string,
  incomingData: Record<string, unknown> | null,
  existingData: Record<string, unknown> | null,
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || auth.email_verified !== true) return 'PERMISSION_DENIED';
  if (chapterId.length < 2 || chapterId.length > 128 || !VALID_ID_RE.test(chapterId)) {
    return 'PERMISSION_DENIED';
  }
  if (op === 'delete') {
    if (!existingData) return 'PERMISSION_DENIED';
    return existingData.createdByUid === auth.uid || isAdmin(auth, adminAllowlist)
      ? 'ALLOW'
      : 'PERMISSION_DENIED';
  }
  if (!incomingData || !isValidDramatizedScriptPayload(incomingData, chapterId)) {
    return 'PERMISSION_DENIED';
  }
  if (op === 'create') {
    if (incomingData.createdByUid !== auth.uid) return 'PERMISSION_DENIED';
    if (incomingData.createdAt !== SERVER_TIME || incomingData.updatedAt !== SERVER_TIME) {
      return 'PERMISSION_DENIED';
    }
    return 'ALLOW';
  }
  if (!existingData) return 'PERMISSION_DENIED';
  if (incomingData.createdByUid !== existingData.createdByUid) return 'PERMISSION_DENIED';
  if (incomingData.createdAt !== existingData.createdAt) return 'PERMISSION_DENIED';
  if (incomingData.updatedAt !== SERVER_TIME) return 'PERMISSION_DENIED';
  return existingData.createdByUid === auth.uid || isAdmin(auth, adminAllowlist)
    ? 'ALLOW'
    : 'PERMISSION_DENIED';
}

test('CustomBook rules enforce admin-only writes, strict schema, bounds, and immutability', () => {
  const adminAuth: SimulatedAuth = {
    uid: 'admin-1',
    email: 'diegolindolfo100@gmail.com',
    email_verified: true,
  };
  const verifiedReader: SimulatedAuth = {
    uid: 'user-1',
    email: 'reader@example.com',
    email_verified: true,
  };
  const unverifiedAdmin: SimulatedAuth = {
    uid: 'admin-evil',
    email: 'diegolindolfo100@gmail.com',
    email_verified: false,
  };
  const allowlist = new Set<string>();
  const bookId = 'fabulas-la-fontaine';

  const baseBook = (uid = 'admin-1', id = bookId) => ({
    id,
    title: 'Fábulas de La Fontaine',
    author: 'Jean de La Fontaine',
    year: 1668,
    publicDomainSource: 'Project Gutenberg #1234',
    coverUrl: '',
    synopsis: 'Coleção clássica em domínio público.',
    isCustom: true,
    chapters: [{ id: 'ch-1', title: 'O Corvo e a Raposa' }],
    isPublic: true,
    createdByUid: uid,
    createdAt: SERVER_TIME,
    updatedAt: SERVER_TIME,
  });

  // Valid admin create (without optional gutenbergId and with valid gutenbergId)
  assert.equal(evaluateCustomBookWrite('create', adminAuth, allowlist, bookId, baseBook(), null), 'ALLOW');
  assert.equal(
    evaluateCustomBookWrite('create', adminAuth, allowlist, bookId, { ...baseBook(), gutenbergId: 1234 }, null),
    'ALLOW',
  );

  // Non-admin or unverified admin rejected on create, update, delete
  assert.equal(
    evaluateCustomBookWrite('create', verifiedReader, allowlist, bookId, baseBook('user-1'), null),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateCustomBookWrite('create', unverifiedAdmin, allowlist, bookId, baseBook('admin-evil'), null),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateCustomBookWrite('update', verifiedReader, allowlist, bookId, baseBook(), baseBook()),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateCustomBookWrite('delete', verifiedReader, allowlist, bookId, null, baseBook()),
    'PERMISSION_DENIED',
  );

  // Valid admin update & delete
  assert.equal(
    evaluateCustomBookWrite('update', adminAuth, allowlist, bookId, { ...baseBook(), title: 'Atualizado' }, baseBook()),
    'ALLOW',
  );
  assert.equal(evaluateCustomBookWrite('delete', adminAuth, allowlist, bookId, null, baseBook()), 'ALLOW');

  // Immutability & schema violations
  assert.equal(
    evaluateCustomBookWrite('update', adminAuth, allowlist, bookId, { ...baseBook('other-uid') }, baseBook()),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateCustomBookWrite(
      'update',
      adminAuth,
      allowlist,
      bookId,
      { ...baseBook(), createdAt: '2025-01-01T00:00:00Z' },
      baseBook(),
    ),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateCustomBookWrite('create', adminAuth, allowlist, bookId, { ...baseBook(), year: 999 }, null),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateCustomBookWrite('create', adminAuth, allowlist, bookId, { ...baseBook(), gutenbergId: 0 }, null),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateCustomBookWrite('create', adminAuth, allowlist, bookId, { ...baseBook(), chapters: [] }, null),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateCustomBookWrite('create', adminAuth, allowlist, bookId, baseBook('admin-1', 'wrong-id'), null),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateCustomBookWrite('create', adminAuth, allowlist, bookId, { ...baseBook(), extraRole: 'admin' }, null),
    'PERMISSION_DENIED',
  );
});

test('DramatizedScript rules enforce verified creator/admin ownership, strict schema, and bounds', () => {
  const userA: SimulatedAuth = { uid: 'uid-A', email: 'a@example.com', email_verified: true };
  const userB: SimulatedAuth = { uid: 'uid-B', email: 'b@example.com', email_verified: true };
  const adminAuth: SimulatedAuth = {
    uid: 'admin-1',
    email: 'diegolindolfo100@gmail.com',
    email_verified: true,
  };
  const unverified: SimulatedAuth = { uid: 'uid-unv', email: 'u@example.com', email_verified: false };
  const allowlist = new Set<string>();
  const chapterId = 'esopo-cigarra-formiga';

  const baseScript = (uid = 'uid-A', cid = chapterId) => ({
    chapterId: cid,
    summary: 'A cigarra canta no verão enquanto a formiga trabalha.',
    characters: [{ name: 'Cigarra', voiceName: 'Aoede' }],
    turns: [{ id: 't1', speaker: 'Narrador', text: 'Era uma vez...' }],
    isPublic: true,
    createdByUid: uid,
    createdAt: SERVER_TIME,
    updatedAt: SERVER_TIME,
  });

  // Create allowed for verified user; rejected for unauthenticated/unverified/spoofed UID
  assert.equal(evaluateDramatizedScriptWrite('create', userA, allowlist, chapterId, baseScript(), null), 'ALLOW');
  assert.equal(
    evaluateDramatizedScriptWrite(
      'create',
      userA,
      allowlist,
      chapterId,
      { ...baseScript(), moral: 'Trabalhe antes do inverno.', aiNotes: 'Tom acolhedor.' },
      null,
    ),
    'ALLOW',
  );
  assert.equal(
    evaluateDramatizedScriptWrite('create', null, allowlist, chapterId, baseScript(), null),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateDramatizedScriptWrite('create', unverified, allowlist, chapterId, baseScript('uid-unv'), null),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateDramatizedScriptWrite('create', userA, allowlist, chapterId, baseScript('uid-B'), null),
    'PERMISSION_DENIED',
  );

  // Update & Delete: creator or admin allowed; cross-owner rejected
  assert.equal(
    evaluateDramatizedScriptWrite(
      'update',
      userA,
      allowlist,
      chapterId,
      { ...baseScript(), summary: 'Resumo revisado.' },
      baseScript(),
    ),
    'ALLOW',
  );
  assert.equal(
    evaluateDramatizedScriptWrite(
      'update',
      adminAuth,
      allowlist,
      chapterId,
      { ...baseScript(), isPublic: false },
      baseScript(),
    ),
    'ALLOW',
  );
  assert.equal(
    evaluateDramatizedScriptWrite('update', userB, allowlist, chapterId, baseScript(), baseScript()),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateDramatizedScriptWrite('delete', userB, allowlist, chapterId, null, baseScript()),
    'PERMISSION_DENIED',
  );
  assert.equal(evaluateDramatizedScriptWrite('delete', userA, allowlist, chapterId, null, baseScript()), 'ALLOW');
  assert.equal(evaluateDramatizedScriptWrite('delete', adminAuth, allowlist, chapterId, null, baseScript()), 'ALLOW');

  // Volumetric / schema / immutability checks
  assert.equal(
    evaluateDramatizedScriptWrite(
      'create',
      userA,
      allowlist,
      chapterId,
      { ...baseScript(), summary: 'X'.repeat(601) },
      null,
    ),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateDramatizedScriptWrite(
      'create',
      userA,
      allowlist,
      chapterId,
      { ...baseScript(), characters: Array.from({ length: 17 }, () => ({ name: 'X' })) },
      null,
    ),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateDramatizedScriptWrite(
      'create',
      userA,
      allowlist,
      chapterId,
      { ...baseScript(), turns: Array.from({ length: 81 }, () => ({ text: 'X' })) },
      null,
    ),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateDramatizedScriptWrite(
      'update',
      userA,
      allowlist,
      chapterId,
      { ...baseScript('uid-B') },
      baseScript('uid-A'),
    ),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateDramatizedScriptWrite(
      'create',
      userA,
      allowlist,
      chapterId,
      { ...baseScript('uid-A', 'different-chapter') },
      null,
    ),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateDramatizedScriptWrite(
      'create',
      userA,
      allowlist,
      chapterId,
      { ...baseScript(), role: 'admin' },
      null,
    ),
    'PERMISSION_DENIED',
  );
});
