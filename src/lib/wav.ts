export interface ParsedWav {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
  pcmData: Uint8Array;
  durationSec: number;
}

export interface WavClipInput {
  id: string;
  wavBuffer: Uint8Array;
  pauseAfterMs?: number;
}

export interface ConcatenatedWavResult {
  wavBuffer: Uint8Array;
  durationSec: number;
  timings: Array<{
    id: string;
    startSec: number;
    endSec: number;
  }>;
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += String.fromCharCode(bytes[offset + i]);
  }
  return out;
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8)) >>> 0;
}

function writeAscii(target: Uint8Array, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    target[offset + i] = text.charCodeAt(i);
  }
}

function writeUint32LE(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function writeUint16LE(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

/**
 * Parses a RIFF/WAVE binary buffer by scanning its chunks so it handles
 * both standard 44-byte headers and headers containing extra chunks (e.g., LIST/INFO).
 */
export function parseWavBuffer(bytes: Uint8Array): ParsedWav {
  if (bytes.length < 44) {
    throw new Error('Buffer WAV inválido: menor que o cabeçalho mínimo de 44 bytes.');
  }

  const riff = readAscii(bytes, 0, 4);
  const wave = readAscii(bytes, 8, 4);
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error(`Formato inválido: esperado RIFF/WAVE, recebido ${riff}/${wave}.`);
  }

  let sampleRate = 24000;
  let numChannels = 1;
  let bitsPerSample = 16;
  let foundFmt = false;
  let pcmData: Uint8Array | null = null;

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkId = readAscii(bytes, offset, 4);
    const chunkSize = readUint32LE(bytes, offset + 4);
    const dataStart = offset + 8;
    const dataEnd = Math.min(dataStart + chunkSize, bytes.length);

    if (chunkId === 'fmt ' && dataEnd - dataStart >= 16) {
      numChannels = readUint16LE(bytes, dataStart + 2);
      sampleRate = readUint32LE(bytes, dataStart + 4);
      bitsPerSample = readUint16LE(bytes, dataStart + 14);
      foundFmt = true;
    } else if (chunkId === 'data') {
      pcmData = bytes.slice(dataStart, dataEnd);
      break;
    }

    // WAV chunks are word-aligned (padded to even byte boundary)
    offset = dataStart + chunkSize + (chunkSize % 2);
  }

  if (!foundFmt || !pcmData) {
    throw new Error('Buffer WAV incompleto: subchunks fmt ou data não encontrados.');
  }

  const bytesPerSecond = sampleRate * numChannels * (bitsPerSample / 8);
  const durationSec = bytesPerSecond > 0 ? pcmData.length / bytesPerSecond : 0;

  return {
    sampleRate,
    numChannels,
    bitsPerSample,
    pcmData,
    durationSec,
  };
}

/**
 * Wraps raw PCM bytes in a clean 44-byte RIFF/WAVE header.
 */
export function buildWavFromPcm(
  pcmData: Uint8Array,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16,
): Uint8Array {
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const headerSize = 44;
  const wav = new Uint8Array(headerSize + pcmData.length);

  writeAscii(wav, 0, 'RIFF');
  writeUint32LE(wav, 4, 36 + pcmData.length);
  writeAscii(wav, 8, 'WAVE');
  writeAscii(wav, 12, 'fmt ');
  writeUint32LE(wav, 16, 16); // PCM fmt chunk size
  writeUint16LE(wav, 20, 1); // AudioFormat = 1 (PCM)
  writeUint16LE(wav, 22, numChannels);
  writeUint32LE(wav, 24, sampleRate);
  writeUint32LE(wav, 28, byteRate);
  writeUint16LE(wav, 32, blockAlign);
  writeUint16LE(wav, 34, bitsPerSample);
  writeAscii(wav, 36, 'data');
  writeUint32LE(wav, 40, pcmData.length);

  wav.set(pcmData, headerSize);
  return wav;
}

/**
 * Creates silent PCM bytes of the specified duration in milliseconds.
 */
export function createSilencePcm(
  durationMs: number,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16,
): Uint8Array {
  if (durationMs <= 0) {
    return new Uint8Array(0);
  }
  const blockAlign = numChannels * (bitsPerSample / 8);
  const frameCount = Math.round((sampleRate * durationMs) / 1000);
  return new Uint8Array(frameCount * blockAlign);
}

/**
 * Concatenates multiple unary Gemini WAV clips into a single seamless WAV file,
 * inserting optional natural pauses and returning exact segment timestamps.
 */
export function concatWavClips(clips: WavClipInput[]): ConcatenatedWavResult {
  if (clips.length === 0) {
    throw new Error('Nenhum clipe de áudio fornecido para concatenação.');
  }

  const parsedClips = clips.map((clip) => ({
    id: clip.id,
    pauseAfterMs: clip.pauseAfterMs ?? 0,
    parsed: parseWavBuffer(clip.wavBuffer),
  }));

  const { sampleRate, numChannels, bitsPerSample } = parsedClips[0].parsed;
  const bytesPerSecond = sampleRate * numChannels * (bitsPerSample / 8);

  const chunks: Uint8Array[] = [];
  const timings: Array<{ id: string; startSec: number; endSec: number }> = [];
  let cursorBytes = 0;

  for (let i = 0; i < parsedClips.length; i++) {
    const item = parsedClips[i];
    if (
      item.parsed.sampleRate !== sampleRate ||
      item.parsed.numChannels !== numChannels ||
      item.parsed.bitsPerSample !== bitsPerSample
    ) {
      throw new Error('Os clipes WAV possuem parâmetros de amostragem incompatíveis.');
    }

    const startSec = cursorBytes / bytesPerSecond;
    chunks.push(item.parsed.pcmData);
    cursorBytes += item.parsed.pcmData.length;
    const endSec = cursorBytes / bytesPerSecond;

    timings.push({
      id: item.id,
      startSec: Number(startSec.toFixed(3)),
      endSec: Number(endSec.toFixed(3)),
    });

    if (i < parsedClips.length - 1 && item.pauseAfterMs > 0) {
      const silence = createSilencePcm(item.pauseAfterMs, sampleRate, numChannels, bitsPerSample);
      chunks.push(silence);
      cursorBytes += silence.length;
    }
  }

  const mergedPcm = new Uint8Array(cursorBytes);
  let offset = 0;
  for (const chunk of chunks) {
    mergedPcm.set(chunk, offset);
    offset += chunk.length;
  }

  const wavBuffer = buildWavFromPcm(mergedPcm, sampleRate, numChannels, bitsPerSample);
  const durationSec = Number((cursorBytes / bytesPerSecond).toFixed(3));

  return {
    wavBuffer,
    durationSec,
    timings,
  };
}
