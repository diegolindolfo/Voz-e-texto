import test from 'node:test';
import assert from 'node:assert/strict';
import { convertWavBufferToMp3 } from './mp3';
import { buildWavFromPcm } from './wav';

test('convertWavBufferToMp3 produces valid MPEG frames much smaller than source WAV', () => {
  const sampleRate = 24000;
  const durationSec = 1;
  const totalSamples = sampleRate * durationSec;
  const pcmBytes = new Uint8Array(totalSamples * 2);
  const view = new DataView(pcmBytes.buffer);

  // 440 Hz sine wave at 24kHz mono 16-bit PCM
  for (let i = 0; i < totalSamples; i++) {
    const sample = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 16000);
    view.setInt16(i * 2, sample, true);
  }

  const wavBuffer = buildWavFromPcm(pcmBytes, sampleRate, 1, 16);
  const { mp3Buffer, durationSec: outDuration } = convertWavBufferToMp3(wavBuffer, 64);

  assert.equal(outDuration, 1);
  assert.ok(mp3Buffer.byteLength > 1000, 'MP3 output should not be empty');
  assert.ok(
    mp3Buffer.byteLength * 4 < wavBuffer.byteLength,
    `Expected MP3 (${mp3Buffer.byteLength}B) to be at least 4x smaller than WAV (${wavBuffer.byteLength}B)`,
  );

  // Check MPEG audio frame sync word (11 set bits: 0xFF followed by 0xE0 mask)
  assert.equal(mp3Buffer[0], 0xff);
  assert.equal(mp3Buffer[1] & 0xe0, 0xe0);
});
