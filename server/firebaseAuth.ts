import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import firebaseConfig from '../firebase-applet-config.json';

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const DEFAULT_ADMIN_EMAIL = 'diegolindolfo100@gmail.com';
const DEFAULT_CERTS_TTL_SEC = 3600;

export interface VerifiedAuthUser {
  uid: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
}

export interface AuthenticatedRequest extends Request {
  authUser?: VerifiedAuthUser;
}

interface CertsCache {
  certs: Record<string, string>;
  expiresAtMs: number;
}

let certsCache: CertsCache | null = null;
let inflightCertsFetch: Promise<Record<string, string>> | null = null;

function getFirebaseProjectId(override?: string): string {
  return (
    override?.trim() ||
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    firebaseConfig.projectId
  );
}

function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS;
  if (!raw || !raw.trim()) {
    return new Set([DEFAULT_ADMIN_EMAIL]);
  }
  const parsed = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return new Set(parsed.length > 0 ? parsed : [DEFAULT_ADMIN_EMAIL]);
}

export function isAdminEmail(email?: string): boolean {
  if (!email) return false;
  return getAdminEmails().has(email.trim().toLowerCase());
}

function decodeBase64Url(segment: string): Buffer {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padLen), 'base64');
}

function parseCacheMaxAgeSec(cacheControlHeader: string | null): number {
  if (!cacheControlHeader) return DEFAULT_CERTS_TTL_SEC;
  const match = cacheControlHeader.match(/max-age=(\d+)/i);
  if (!match) return DEFAULT_CERTS_TTL_SEC;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CERTS_TTL_SEC;
}

async function fetchGooglePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && certsCache && now < certsCache.expiresAtMs) {
    return certsCache.certs;
  }

  if (!inflightCertsFetch) {
    inflightCertsFetch = (async () => {
      const response = await fetch(GOOGLE_CERTS_URL);
      if (!response.ok) {
        throw new Error(`Falha ao obter certificados Firebase Auth (HTTP ${response.status}).`);
      }
      const certs = (await response.json()) as Record<string, string>;
      const ttlSec = parseCacheMaxAgeSec(response.headers.get('cache-control'));
      certsCache = {
        certs,
        expiresAtMs: Date.now() + ttlSec * 1000,
      };
      return certs;
    })().finally(() => {
      inflightCertsFetch = null;
    });
  }

  return inflightCertsFetch;
}

export interface VerifyTokenOptions {
  projectId?: string;
  certsOverride?: Record<string, string>;
  nowSec?: number;
}

/**
 * Verifies a Firebase Auth ID Token (RS256 JWT) using Google's public x509 certificates
 * and validates audience, issuer, subject, and expiration timestamps.
 */
export async function verifyFirebaseIdToken(
  token: string,
  options?: VerifyTokenOptions,
): Promise<VerifiedAuthUser> {
  const trimmed = token.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    throw new Error('Token de autenticação malformado.');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;

  try {
    header = JSON.parse(decodeBase64Url(headerB64).toString('utf-8')) as Record<string, unknown>;
    payload = JSON.parse(decodeBase64Url(payloadB64).toString('utf-8')) as Record<string, unknown>;
  } catch {
    throw new Error('Token de autenticação inválido.');
  }

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    throw new Error('Cabeçalho do token de autenticação inválido.');
  }

  let certPem: string | undefined;
  if (options?.certsOverride) {
    certPem = options.certsOverride[header.kid];
  } else {
    let certs = await fetchGooglePublicCerts(false);
    certPem = certs[header.kid];
    if (!certPem) {
      certs = await fetchGooglePublicCerts(true);
      certPem = certs[header.kid];
    }
  }

  if (!certPem) {
    throw new Error('Chave pública do token não encontrada.');
  }

  const signatureBytes = decodeBase64Url(signatureB64);
  const signedContent = Buffer.from(`${headerB64}.${payloadB64}`, 'utf-8');
  const isSignatureValid = crypto.verify('RSA-SHA256', signedContent, certPem, signatureBytes);
  if (!isSignatureValid) {
    throw new Error('Assinatura do token de autenticação inválida.');
  }

  const projectId = getFirebaseProjectId(options?.projectId);
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  const nowSec = options?.nowSec ?? Math.floor(Date.now() / 1000);

  if (payload.aud !== projectId) {
    throw new Error('Token de autenticação não pertence a este projeto.');
  }
  if (payload.iss !== expectedIssuer) {
    throw new Error('Emissor do token de autenticação inválido.');
  }
  if (typeof payload.sub !== 'string' || payload.sub.trim().length === 0) {
    throw new Error('Identificador do usuário ausente no token.');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('Sessão expirada. Entre novamente com sua conta Google.');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new Error('Timestamp de emissão do token inválido.');
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === 'string' ? payload.name : undefined,
  };
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function authenticateRequest(
  req: Request,
  options?: VerifyTokenOptions,
): Promise<VerifiedAuthUser | null> {
  const token = extractBearerToken(req);
  if (!token) return null;
  return verifyFirebaseIdToken(token, options);
}

export async function requireVerifiedAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({
        error: 'Autenticação necessária. Entre com sua conta Google para usar este recurso.',
      });
      return;
    }

    const user = await verifyFirebaseIdToken(token);
    if (!user.emailVerified) {
      res.status(403).json({
        error: 'Sua conta Google precisa ter o e-mail verificado para continuar.',
      });
      return;
    }

    req.authUser = user;
    next();
  } catch (err) {
    res.status(401).json({
      error: err instanceof Error ? err.message : 'Sessão inválida ou expirada.',
    });
  }
}

export async function requireAdminAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireVerifiedAuth(req, res, () => {
    if (!isAdminEmail(req.authUser?.email)) {
      res.status(403).json({
        error: 'Acesso restrito ao administrador curador da biblioteca.',
      });
      return;
    }
    next();
  });
}

export function createRateLimitMiddleware(options: {
  windowMs: number;
  maxRequests: number;
}) {
  const buckets = new Map<string, number[]>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const key = req.authUser?.uid || req.ip || 'anonymous';
    const now = Date.now();
    const cutoff = now - options.windowMs;
    const recent = (buckets.get(key) ?? []).filter((ts) => ts > cutoff);

    if (recent.length >= options.maxRequests) {
      res.status(429).json({
        error: 'Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente.',
        isQuotaError: true,
      });
      return;
    }

    recent.push(now);
    buckets.set(key, recent);

    if (buckets.size > 1000) {
      for (const [entryKey, timestamps] of buckets.entries()) {
        if (timestamps.every((ts) => ts <= cutoff)) {
          buckets.delete(entryKey);
        }
      }
    }

    next();
  };
}
