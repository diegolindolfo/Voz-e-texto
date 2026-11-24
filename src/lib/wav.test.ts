import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWavFromPcm,
  concatWavClips,
  createSilencePcm,
  findSilenceMidpoints,
  parseWavBuffer,
} from './wav';

test('buildWavFromPcm and parseWavBuffer roundtrip standard 24kHz mono PCM', () => {
  const samplePcm = new Uint8Array(4800); // 0.1s at 24kHz * 2 bytes
  for (let i = 0; i < samplePcm.length; i++) {
    samplePcm[i] = i % 251;
  }

  const wav = buildWavFromPcm(samplePcm, 24000, 1, 16);
  assert.equal(wav.length, 44 + samplePcm.length);

  const parsed = parseWavBuffer(wav);
  assert.equal(parsed.sampleRate, 24000);
  assert.equal(parsed.numChannels, 1);
  assert.equal(parsed.bitsPerSample, 16);
  assert.equal(parsed.pcmData.length, 4800);
  assert.equal(Number(parsed.durationSec.toFixed(3)), 0.1);
  assert.deepEqual(parsed.pcmData, samplePcm);
});

test('parseWavBuffer handles WAV buffers with extra LIST metadata chunk before data', () => {
  const pcm = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const standard = buildWavFromPcm(pcm, 24000, 1, 16);

  // Splice a 14-byte LIST chunk (8-byte header + 6 bytes payload) between fmt and data
  const listChunk = new Uint8Array(14);
  listChunk.set([0x4c, 0x49, 0x53, 0x54], 0); // "LIST"
  listChunk[4] = 6; // size = 6
  const withExtra = new Uint8Array(standard.length + listChunk.length);
  withExtra.set(standard.slice(0, 36), 0);
  withExtra.set(listChunk, 36);
  withExtra.set(standard.slice(36), 36 + listChunk.length);

  const parsed = parseWavBuffer(withExtra);
  assert.deepEqual(parsed.pcmData, pcm);
});

test('concatWavClips merges clips with natural pause gaps and exact segment timings', () => {
  const clipA = buildWavFromPcm(createSilencePcm(500, 24000, 1, 16), 24000, 1, 16);
  const clipB = buildWavFromPcm(createSilencePcm(1000, 24000, 1, 16), 24000, 1, 16);

  const result = concatWavClips([
    { id: 't1', wavBuffer: clipA, pauseAfterMs: 250 },
    { id: 't2', wavBuffer: clipB, pauseAfterMs: 300 },
  ]);

  // Expected total: 0.5s + 0.25s pause + 1.0s = 1.75s (trailing pause on last clip is not added)
  assert.equal(result.durationSec, 1.75);
  assert.equal(result.timings.length, 2);
  assert.deepEqual(result.timings[0], { id: 't1', startSec: 0, endSec: 0.5 });
  assert.deepEqual(result.timings[1], { id: 't2', startSec: 0.75, endSec: 1.75 });

  const reparsed = parseWavBuffer(result.wavBuffer);
  assert.equal(Number(reparsed.durationSec.toFixed(3)), 1.75);
});

test('findSilenceMidpoints locates real inter-turn pause midpoints in 16-bit PCM audio', () => {
  const sampleRate = 24000;
  const makeTonePcm = (durationMs: number): Uint8Array => {
    const frames = Math.round((sampleRate * durationMs) / 1000);
    const pcm = new Uint8Array(frames * 2);
    const view = new DataView(pcm.buffer);
    for (let i = 0; i < frames; i++) {
      const val = Math.round(Math.sin((2 * Math.PI * 330 * i) / sampleRate) * 14000);
      view.setInt16(i * 2, val, true);
    }
    return pcm;
  };

  // 1.0s tone + 0.4s silence + 1.0s tone -> pause midpoint at 1.2s
  const wav = concatWavClips([
    { id: 'a', wavBuffer: buildWavFromPcm(makeTonePcm(1000), sampleRate, 1, 16), pauseAfterMs: 400 },
    { id: 'b', wavBuffer: buildWavFromPcm(makeTonePcm(1000), sampleRate, 1, 16), pauseAfterMs: 0 },
  ]).wavBuffer;

  const parsed = parseWavBuffer(wav);
  const silences = findSilenceMidpoints(parsed);
  assert.equal(silences.length, 1);
  assert.ok(Math.abs(silences[0].timeSec - 1.2) <= 0.05, `Expected ~1.2s, got ${silences[0].timeSec}`);
  assert.ok(silences[0].durationMs >= 320);
});
