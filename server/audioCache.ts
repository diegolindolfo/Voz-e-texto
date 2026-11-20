import fs from 'node:fs';
import path from 'node:path';
import type { CachedAudioMetadata, CacheInventoryResponse, CacheSummaryItem } from '../src/types';

const CACHE_DIR = path.resolve(process.cwd(), 'data', 'audio-cache');

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function sanitizeKey(cacheKey: string): string {
  if (!/^[a-zA-Z0-9_-]{4,128}$/.test(cacheKey)) {
    throw new Error('Chave de cache inválida.');
  }
  return cacheKey;
}

export function getWavFilePath(cacheKey: string): string {
  ensureCacheDir();
  return path.join(CACHE_DIR, `${sanitizeKey(cacheKey)}.wav`);
}

function getMetaFilePath(cacheKey: string): string {
  ensureCacheDir();
  return path.join(CACHE_DIR, `${sanitizeKey(cacheKey)}.json`);
}

export function readCachedAudio(cacheKey: string): CachedAudioMetadata | null {
  try {
    const safe = sanitizeKey(cacheKey);
    const wavPath = getWavFilePath(safe);
    const metaPath = getMetaFilePath(safe);
    if (!fs.existsSync(wavPath) || !fs.existsSync(metaPath)) {
      return null;
    }
    const raw = fs.readFileSync(metaPath, 'utf-8');
    const parsed = JSON.parse(raw) as CachedAudioMetadata;
    const stats = fs.statSync(wavPath);
    if (stats.size < 44) {
      return null;
    }
    return {
      ...parsed,
      fileSizeBytes: stats.size,
      audioUrl: `/api/audio/${safe}`,
    };
  } catch {
    return null;
  }
}

export function writeCachedAudio(
  cacheKey: string,
  wavBytes: Uint8Array,
  metadata: Omit<CachedAudioMetadata, 'cacheKey' | 'fileSizeBytes' | 'audioUrl' | 'createdAt'>,
): CachedAudioMetadata {
  const safe = sanitizeKey(cacheKey);
  const wavPath = getWavFilePath(safe);
  const metaPath = getMetaFilePath(safe);
  const tmpWavPath = `${wavPath}.tmp`;
  const tmpMetaPath = `${metaPath}.tmp`;

  const fullMeta: CachedAudioMetadata = {
    ...metadata,
    cacheKey: safe,
    fileSizeBytes: wavBytes.byteLength,
    createdAt: new Date().toISOString(),
    audioUrl: `/api/audio/${safe}`,
  };

  fs.writeFileSync(tmpWavPath, wavBytes);
  fs.renameSync(tmpWavPath, wavPath);

  fs.writeFileSync(tmpMetaPath, JSON.stringify(fullMeta, null, 2), 'utf-8');
  fs.renameSync(tmpMetaPath, metaPath);

  return fullMeta;
}

export function listCachedAudios(): CacheInventoryResponse {
  ensureCacheDir();
  const files = fs.readdirSync(CACHE_DIR);
  const items: CacheSummaryItem[] = [];
  let totalSizeBytes = 0;

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const key = file.slice(0, -5);
    const meta = readCachedAudio(key);
    if (meta) {
      items.push({ ...meta, exists: true });
      totalSizeBytes += meta.fileSizeBytes;
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
  const wavPath = getWavFilePath(safe);
  const metaPath = getMetaFilePath(safe);
  let removed = false;

  if (fs.existsSync(wavPath)) {
    fs.unlinkSync(wavPath);
    removed = true;
  }
  if (fs.existsSync(metaPath)) {
    fs.unlinkSync(metaPath);
    removed = true;
  }
  clearPartialBatchCache(safe);
  return removed;
}

function getPartialsDir(cacheKey: string): string {
  ensureCacheDir();
  return path.join(CACHE_DIR, 'partials', sanitizeKey(cacheKey));
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
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
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
