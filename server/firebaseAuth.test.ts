import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { isAdminEmail, verifyFirebaseIdToken } from './firebaseAuth';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function signTestJwt(
  payload: Record<string, unknown>,
  headerOverrides?: Record<string, unknown>,
): string {
  const header = { alg: 'RS256', kid: 'test-kid', typ: 'JWT', ...headerOverrides };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto.sign(
    'RSA-SHA256',
    Buffer.from(`${headerB64}.${payloadB64}`, 'utf-8'),
    privateKey,
  );
  return `${headerB64}.${payloadB64}.${base64UrlEncode(signature)}`;
}

const TEST_PROJECT_ID = 'test-voz-e-folha';
const NOW_SEC = 1_800_000_000;

test('verifyFirebaseIdToken accepts valid RS256 token and returns verified user', async () => {
  const token = signTestJwt({
    aud: TEST_PROJECT_ID,
    iss: `https://securetoken.google.com/${TEST_PROJECT_ID}`,
    sub: 'user-123',
    email: 'leitor@example.com',
    email_verified: true,
    name: 'Leitor Teste',
    iat: NOW_SEC - 60,
    exp: NOW_SEC + 3600,
  });

  const user = await verifyFirebaseIdToken(token, {
    projectId: TEST_PROJECT_ID,
    certsOverride: { 'test-kid': publicKeyPem },
    nowSec: NOW_SEC,
  });

  assert.equal(user.uid, 'user-123');
  assert.equal(user.email, 'leitor@example.com');
  assert.equal(user.emailVerified, true);
  assert.equal(user.name, 'Leitor Teste');
});

test('verifyFirebaseIdToken rejects tampered signature, expired token, and wrong aud/iss', async () => {
  const validToken = signTestJwt({
    aud: TEST_PROJECT_ID,
    iss: `https://securetoken.google.com/${TEST_PROJECT_ID}`,
    sub: 'user-123',
    email_verified: true,
    iat: NOW_SEC - 60,
    exp: NOW_SEC + 3600,
  });

  const parts = validToken.split('.');
  const tamperedPayload = base64UrlEncode(
    JSON.stringify({
      aud: TEST_PROJECT_ID,
      iss: `https://securetoken.google.com/${TEST_PROJECT_ID}`,
      sub: 'admin-evil',
      email_verified: true,
      iat: NOW_SEC - 60,
      exp: NOW_SEC + 3600,
    }),
  );

  await assert.rejects(
    verifyFirebaseIdToken(`${parts[0]}.${tamperedPayload}.${parts[2]}`, {
      projectId: TEST_PROJECT_ID,
      certsOverride: { 'test-kid': publicKeyPem },
      nowSec: NOW_SEC,
    }),
    /Assinatura/,
  );

  const expiredToken = signTestJwt({
    aud: TEST_PROJECT_ID,
    iss: `https://securetoken.google.com/${TEST_PROJECT_ID}`,
    sub: 'user-123',
    iat: NOW_SEC - 7200,
    exp: NOW_SEC - 10,
  });

  await assert.rejects(
    verifyFirebaseIdToken(expiredToken, {
      projectId: TEST_PROJECT_ID,
      certsOverride: { 'test-kid': publicKeyPem },
      nowSec: NOW_SEC,
    }),
    /expirada/i,
  );

  const wrongAudToken = signTestJwt({
    aud: 'other-project',
    iss: `https://securetoken.google.com/${TEST_PROJECT_ID}`,
    sub: 'user-123',
    iat: NOW_SEC - 60,
    exp: NOW_SEC + 3600,
  });

  await assert.rejects(
    verifyFirebaseIdToken(wrongAudToken, {
      projectId: TEST_PROJECT_ID,
      certsOverride: { 'test-kid': publicKeyPem },
      nowSec: NOW_SEC,
    }),
    /projeto/,
  );

  const wrongIssToken = signTestJwt({
    aud: TEST_PROJECT_ID,
    iss: 'https://accounts.google.com',
    sub: 'user-123',
    iat: NOW_SEC - 60,
    exp: NOW_SEC + 3600,
  });

  await assert.rejects(
    verifyFirebaseIdToken(wrongIssToken, {
      projectId: TEST_PROJECT_ID,
      certsOverride: { 'test-kid': publicKeyPem },
      nowSec: NOW_SEC,
    }),
    /Emissor/,
  );
});

test('verifyFirebaseIdToken reports emailVerified false for unverified email and isAdminEmail checks admin allowlist', async () => {
  const unverifiedToken = signTestJwt({
    aud: TEST_PROJECT_ID,
    iss: `https://securetoken.google.com/${TEST_PROJECT_ID}`,
    sub: 'user-unverified',
    email: 'diegolindolfo100@gmail.com',
    email_verified: false,
    iat: NOW_SEC - 60,
    exp: NOW_SEC + 3600,
  });

  const user = await verifyFirebaseIdToken(unverifiedToken, {
    projectId: TEST_PROJECT_ID,
    certsOverride: { 'test-kid': publicKeyPem },
    nowSec: NOW_SEC,
  });
  assert.equal(user.emailVerified, false);

  assert.equal(isAdminEmail('diegolindolfo100@gmail.com'), true);
  assert.equal(isAdminEmail('DiegoLindolfo100@GMAIL.com'), true);
  assert.equal(isAdminEmail('other@example.com'), false);
  assert.equal(isAdminEmail(undefined), false);
});
