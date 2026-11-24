import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { STATIC_PRERENDERED_AUDIOS } from '../src/data/prerenderedAudioCatalog';
import type {
  AudioMimeType,
  CachedAudioMetadata,
  CacheInventoryResponse,
  CacheSummaryItem,
} from '../src/types';

const BUNDLED_CACHE_DIR = path.resolve(process.cwd(), 'data', 'audio-cache');
const PUBLIC_CACHE_DIR = path.resolve(process.cwd(), 'public', 'audio-cache');
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const WRITABLE_CACHE_DIR = IS_SERVERLESS
  ? path.join(os.tmpdir(), 'voz-e-folha', 'audio-cache')
  : BUNDLED_CACHE_DIR;

export interface ResolvedAudioFile {
  filePath: string;
  mimeType: AudioMimeType;
  ext: 'mp3' | 'wav';
}

function ensureWritableDir(dir: string = WRITABLE_CACHE_DIR): void {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
    // Ignore on read-only environments
  }
}

function sanitizeKey(cacheKey: string): string {
  if (!/^[a-zA-Z0-9_-]{4,128}$/.test(cacheKey)) {
    throw new Error('Chave de cache inválida.');
  }
  return cacheKey;
}

export function resolveAudioFile(cacheKey: string): ResolvedAudioFile | null {
  const safe = sanitizeKey(cacheKey);
  ensureWritableDir();
  const dirs = Array.from(new Set([WRITABLE_CACHE_DIR, BUNDLED_CACHE_DIR, PUBLIC_CACHE_DIR]));
  const formats: Array<{ ext: 'mp3' | 'wav'; mimeType: AudioMimeType }> = [
    { ext: 'mp3', mimeType: 'audio/mpeg' },
    { ext: 'wav', mimeType: 'audio/wav' },
  ];

  for (const dir of dirs) {
    for (const fmt of formats) {
      const candidate = path.join(dir, `${safe}.${fmt.ext}`);
      if (fs.existsSync(candidate)) {
        return {
          filePath: candidate,
          mimeType: fmt.mimeType,
          ext: fmt.ext,
        };
      }
    }
  }
  return null;
}

export function getWavFilePath(cacheKey: string): string {
  const resolved = resolveAudioFile(cacheKey);
  if (resolved) return resolved.filePath;
  const safe = sanitizeKey(cacheKey);
  return path.join(WRITABLE_CACHE_DIR, `${safe}.mp3`);
}

function resolveMetaFilePath(cacheKey: string): string {
  const safe = sanitizeKey(cacheKey);
  ensureWritableDir();
  const writableMeta = path.join(WRITABLE_CACHE_DIR, `${safe}.json`);
  if (fs.existsSync(writableMeta)) {
    return writableMeta;
  }
  const bundledMeta = path.join(BUNDLED_CACHE_DIR, `${safe}.json`);
  if (fs.existsSync(bundledMeta)) {
    return bundledMeta;
  }
  const publicMeta = path.join(PUBLIC_CACHE_DIR, `${safe}.json`);
  if (fs.existsSync(publicMeta)) {
    return publicMeta;
  }
  return writableMeta;
}

export function readCachedAudio(cacheKey: string): CachedAudioMetadata | null {
  try {
    const safe = sanitizeKey(cacheKey);
    const staticEntry = STATIC_PRERENDERED_AUDIOS[safe];
    if (staticEntry) {
      return staticEntry;
    }

    const resolvedAudio = resolveAudioFile(safe);
    const metaPath = resolveMetaFilePath(safe);
    if (!resolvedAudio || !fs.existsSync(metaPath)) {
      return null;
    }
    const raw = fs.readFileSync(metaPath, 'utf-8');
    const parsed = JSON.parse(raw) as CachedAudioMetadata;
    const stats = fs.statSync(resolvedAudio.filePath);
    if (stats.size < 44) {
      return null;
    }
    return {
      ...parsed,
      mimeType: parsed.mimeType ?? resolvedAudio.mimeType,
      fileSizeBytes: stats.size,
      audioUrl: `/api/audio/${safe}`,
    };
  } catch {
    const safe = cacheKey.replace(/[^a-zA-Z0-9_-]/g, '');
    return STATIC_PRERENDERED_AUDIOS[safe] ?? null;
  }
}

export function writeCachedAudio(
  cacheKey: string,
  audioBytes: Uint8Array,
  metadata: Omit<CachedAudioMetadata, 'cacheKey' | 'fileSizeBytes' | 'audioUrl' | 'createdAt'>,
): CachedAudioMetadata {
  const safe = sanitizeKey(cacheKey);
  ensureWritableDir();
  const mimeType: AudioMimeType = metadata.mimeType === 'audio/wav' ? 'audio/wav' : 'audio/mpeg';
  const ext = mimeType === 'audio/wav' ? 'wav' : 'mp3';
  const audioPath = path.join(WRITABLE_CACHE_DIR, `${safe}.${ext}`);
  const metaPath = path.join(WRITABLE_CACHE_DIR, `${safe}.json`);
  const tmpAudioPath = `${audioPath}.tmp`;
  const tmpMetaPath = `${metaPath}.tmp`;

  const fullMeta: CachedAudioMetadata = {
    ...metadata,
    mimeType,
    cacheKey: safe,
    fileSizeBytes: audioBytes.byteLength,
    createdAt: new Date().toISOString(),
    audioUrl: `/api/audio/${safe}`,
  };

  fs.writeFileSync(tmpAudioPath, audioBytes);
  fs.renameSync(tmpAudioPath, audioPath);

  fs.writeFileSync(tmpMetaPath, JSON.stringify(fullMeta, null, 2), 'utf-8');
  fs.renameSync(tmpMetaPath, metaPath);

  return fullMeta;
}

export function listCachedAudios(): CacheInventoryResponse {
  ensureWritableDir();
  const candidateDirs = Array.from(
    new Set([WRITABLE_CACHE_DIR, BUNDLED_CACHE_DIR, PUBLIC_CACHE_DIR]),
  );

  const seenKeys = new Set<string>();
  const items: CacheSummaryItem[] = [];
  let totalSizeBytes = 0;

  for (const staticMeta of Object.values(STATIC_PRERENDERED_AUDIOS)) {
    seenKeys.add(staticMeta.cacheKey);
    items.push({ ...staticMeta, exists: true });
    totalSizeBytes += staticMeta.fileSizeBytes;
  }

  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const key = file.slice(0, -5);
      if (seenKeys.has(key)) continue;
      const meta = readCachedAudio(key);
      if (meta) {
        seenKeys.add(key);
        items.push({ ...meta, exists: true });
        totalSizeBytes += meta.fileSizeBytes;
      }
    }
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    items,
    totalSizeBytes,
    count: items.length,
  };
}

export function deleteCachedAudio(cacheKey: string): boolean {
  const safe = sanitizeKey(cacheKey);
  ensureWritableDir();
  const pathsToDelete = [
    path.join(WRITABLE_CACHE_DIR, `${safe}.mp3`),
    path.join(WRITABLE_CACHE_DIR, `${safe}.wav`),
    path.join(WRITABLE_CACHE_DIR, `${safe}.json`),
  ];
  let removed = false;

  try {
    for (const target of pathsToDelete) {
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
        removed = true;
      }
    }
  } catch {
    // Bundled read-only files in Vercel cannot be unlinked from disk
  }
  clearPartialBatchCache(safe);
  return removed;
}

function getPartialsDir(cacheKey: string): string {
  ensureWritableDir();
  return path.join(WRITABLE_CACHE_DIR, 'partials', sanitizeKey(cacheKey));
}

function getPartialBatchPath(cacheKey: string, batchIndex: number, fingerprint: string): string {
  const safeFp = fingerprint.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'batch';
  return path.join(getPartialsDir(cacheKey), `b${batchIndex}-${safeFp}.wav`);
}

export function readPartialBatchWav(
  cacheKey: string,
  batchIndex: number,
  fingerprint: string,
): Uint8Array | null {
  try {
    const filePath = getPartialBatchPath(cacheKey, batchIndex, fingerprint);
    if (!fs.existsSync(filePath)) return null;
    const stats = fs.statSync(filePath);
    if (stats.size < 44) return null;
    return new Uint8Array(fs.readFileSync(filePath));
  } catch {
    return null;
  }
}

export function writePartialBatchWav(
  cacheKey: string,
  batchIndex: number,
  fingerprint: string,
  wavBytes: Uint8Array,
): void {
  try {
    const dir = getPartialsDir(cacheKey);
    ensureWritableDir(dir);
    const filePath = getPartialBatchPath(cacheKey, batchIndex, fingerprint);
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, wavBytes);
    fs.renameSync(tmpPath, filePath);
  } catch {
    // Non-fatal: partial cache is an optimization
  }
}

export function clearPartialBatchCache(cacheKey: string): void {
  try {
    const dir = getPartialsDir(cacheKey);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch {
    // Ignore cleanup errors
  }
}
