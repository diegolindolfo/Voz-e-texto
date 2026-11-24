import * as lamejs from '@breezystack/lamejs';
import { parseWavBuffer } from './wav';

const MP3_FRAME_SAMPLES = 1152;

type Mp3EncoderConstructor = typeof lamejs.Mp3Encoder;

function getMp3EncoderCtor(): Mp3EncoderConstructor {
  const mod = lamejs as unknown as {
    Mp3Encoder?: Mp3EncoderConstructor;
    default?: { Mp3Encoder?: Mp3EncoderConstructor };
  };
  const ctor = mod.Mp3Encoder ?? mod.default?.Mp3Encoder;
  if (typeof ctor !== 'function') {
    throw new Error('Codificador MP3 (@breezystack/lamejs) indisponível neste ambiente.');
  }
  return ctor;
}

function readInt16Samples(pcmBytes: Uint8Array): Int16Array {
  const sampleCount = Math.floor(pcmBytes.byteLength / 2);
  const samples = new Int16Array(sampleCount);
  const view = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, sampleCount * 2);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = view.getInt16(i * 2, true);
  }
  return samples;
}

function concatByteChunks(chunks: Array<Uint8Array | Int8Array>): Uint8Array {
  let totalLength = 0;
  for (const chunk of chunks) {
    totalLength += chunk.length;
  }
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength), offset);
    offset += chunk.length;
  }
  return output;
}

/**
 * Encodes 16-bit little-endian PCM bytes into a compact MP3 stream in pure JavaScript.
 */
export function encodePcm16ToMp3(
  pcmBytes: Uint8Array,
  sampleRate = 24000,
  numChannels = 1,
  kbps = 64,
): Uint8Array {
  const channels = numChannels === 2 ? 2 : 1;
  const Mp3EncoderCtor = getMp3EncoderCtor();
  const encoder = new Mp3EncoderCtor(channels, sampleRate, kbps);
  const samples = readInt16Samples(pcmBytes);
  const chunks: Array<Uint8Array | Int8Array> = [];

  if (channels === 1) {
    for (let i = 0; i < samples.length; i += MP3_FRAME_SAMPLES) {
      const slice = samples.subarray(i, Math.min(i + MP3_FRAME_SAMPLES, samples.length));
      const encoded = encoder.encodeBuffer(slice);
      if (encoded.length > 0) {
        chunks.push(encoded);
      }
    }
  } else {
    const frames = Math.floor(samples.length / 2);
    const left = new Int16Array(frames);
    const right = new Int16Array(frames);
    for (let i = 0; i < frames; i++) {
      left[i] = samples[i * 2];
      right[i] = samples[i * 2 + 1];
    }
    for (let i = 0; i < frames; i += MP3_FRAME_SAMPLES) {
      const end = Math.min(i + MP3_FRAME_SAMPLES, frames);
      const encoded = encoder.encodeBuffer(left.subarray(i, end), right.subarray(i, end));
      if (encoded.length > 0) {
        chunks.push(encoded);
      }
    }
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) {
    chunks.push(flushed);
  }

  return concatByteChunks(chunks);
}

/**
 * Converts a RIFF/WAVE binary buffer into a compressed MP3 buffer while preserving duration metadata.
 */
export function convertWavBufferToMp3(
  wavBytes: Uint8Array,
  kbps = 64,
): { mp3Buffer: Uint8Array; durationSec: number } {
  const parsed = parseWavBuffer(wavBytes);
  if (parsed.bitsPerSample !== 16) {
    throw new Error(`Profundidade PCM não suportada para MP3: ${parsed.bitsPerSample} bits.`);
  }
  const mp3Buffer = encodePcm16ToMp3(
    parsed.pcmData,
    parsed.sampleRate,
    parsed.numChannels,
    kbps,
  );
  return {
    mp3Buffer,
    durationSec: Number(parsed.durationSec.toFixed(3)),
  };
}
