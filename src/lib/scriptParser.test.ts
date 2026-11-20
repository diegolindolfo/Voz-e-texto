import test from 'node:test';
import assert from 'node:assert/strict';
import {
  batchTurnsForTts,
  computeChapterCacheKey,
  expandBatchTimingsToTurns,
  findActiveSegmentIndex,
  formatBytes,
  formatDuration,
  resolveVoiceForTurn,
  splitRawTextIntoParagraphs,
} from './scriptParser';
import type { AudioSegmentTiming, ScriptTurn } from '../types';

test('computeChapterCacheKey is deterministic and changes when voice or mode changes', () => {
  const turns: ScriptTurn[] = [
    {
      id: 't1',
      speaker: 'Bentinho',
      role: 'narrator',
      style: 'Calmo',
      text: 'Uma noite destas, vindo da cidade.',
      pauseAfterMs: 300,
    },
  ];

  const keyA = computeChapterCacheKey({
    chapterId: 'dc-cap-1',
    mode: 'dramatized',
    turns,
    voiceMap: { Bentinho: 'Charon' },
  });
  const keyB = computeChapterCacheKey({
    chapterId: 'dc-cap-1',
    mode: 'dramatized',
    turns,
    voiceMap: { Bentinho: 'Charon' },
  });
  const keyDifferentVoice = computeChapterCacheKey({
    chapterId: 'dc-cap-1',
    mode: 'dramatized',
    turns,
    voiceMap: { Bentinho: 'Fenrir' },
  });
  const keySoloMode = computeChapterCacheKey({
    chapterId: 'dc-cap-1',
    mode: 'narrator',
    turns,
    voiceMap: { Bentinho: 'Charon' },
  });

  assert.equal(keyA, keyB);
  assert.notEqual(keyA, keyDifferentVoice);
  assert.notEqual(keyA, keySoloMode);
});

test('findActiveSegmentIndex resolves exact active turn and holds highlight during inter-turn silence', () => {
  const segments: AudioSegmentTiming[] = [
    { turnId: 't1', speaker: 'Bentinho', voiceName: 'Charon', startSec: 0, endSec: 5.0 },
    { turnId: 't2', speaker: 'Poeta', voiceName: 'Puck', startSec: 5.3, endSec: 7.2 },
    { turnId: 't3', speaker: 'Bentinho', voiceName: 'Charon', startSec: 7.5, endSec: 12.0 },
  ];

  assert.equal(findActiveSegmentIndex(segments, 0), 0);
  assert.equal(findActiveSegmentIndex(segments, 4.9), 0);
  assert.equal(findActiveSegmentIndex(segments, 5.15), 0);
  assert.equal(findActiveSegmentIndex(segments, 5.35), 1);
  assert.equal(findActiveSegmentIndex(segments, 10.2), 2);
  assert.equal(findActiveSegmentIndex(segments, 13.0), 2);
});

test('formatDuration and formatBytes format Brazilian mobile UI values cleanly', () => {
  assert.equal(formatDuration(0), '00:00');
  assert.equal(formatDuration(65), '01:05');
  assert.equal(formatDuration(185.9), '03:05');
  assert.equal(formatBytes(512 * 1024), '512 KB');
  assert.equal(formatBytes(2.4 * 1024 * 1024), '2,4 MB');
});

test('splitRawTextIntoParagraphs and resolveVoiceForTurn behave predictably', () => {
  const paragraphs = splitRawTextIntoParagraphs('Primeiro parágrafo.\n\n  Segundo   parágrafo. \n\n');
  assert.deepEqual(paragraphs, ['Primeiro parágrafo.', 'Segundo parágrafo.']);

  const turn: ScriptTurn = {
    id: 't2',
    speaker: 'Jovem Poeta',
    role: 'character',
    style: 'Amuado',
    text: 'Já acabei.',
  };
  assert.equal(
    resolveVoiceForTurn(turn, { 'Jovem Poeta': 'Puck' }, 'dramatized', 'Charon'),
    'Puck',
  );
  assert.equal(
    resolveVoiceForTurn(turn, { 'Jovem Poeta': 'Puck' }, 'narrator', 'Charon'),
    'Charon',
  );
});

test('batchTurnsForTts groups multi-character chapters into minimal 1- or 2-speaker TTS calls', () => {
  const turns: ScriptTurn[] = [
    { id: 't1', speaker: 'Bentinho', role: 'narrator', style: 'Calmo', text: 'No trem da Central.' },
    { id: 't2', speaker: 'Poeta', role: 'character', style: 'Amuado', text: 'Já acabei.' },
    { id: 't3', speaker: 'Bentinho', role: 'narrator', style: 'Cortês', text: 'São muito bonitos.' },
    { id: 't4', speaker: 'Amigos', role: 'character', style: 'Alegre', text: 'Dom Casmurro, venha jantar.' },
    { id: 't5', speaker: 'Bentinho', role: 'narrator', style: 'Irônico', text: 'Não consultes dicionários.' },
  ];

  const batches = batchTurnsForTts(
    turns,
    { Bentinho: 'Charon', Poeta: 'Puck', Amigos: 'Zephyr' },
    'dramatized',
    'Charon',
  );

  // 5 turns across 3 speakers compress cleanly into 2 dual-speaker TTS batches!
  assert.equal(batches.length, 2);
  assert.equal(batches[0].speakers.length, 2);
  assert.equal(batches[0].turns.length, 3);
  assert.equal(batches[1].speakers.length, 2);
  assert.equal(batches[1].turns.length, 2);

  const expanded = expandBatchTimingsToTurns(batches, [
    { id: 'batch-1', startSec: 0, endSec: 10 },
    { id: 'batch-2', startSec: 10.3, endSec: 20.3 },
  ]);

  assert.equal(expanded.length, 5);
  assert.equal(expanded[0].startSec, 0);
  assert.equal(expanded[2].endSec, 10);
  assert.equal(expanded[3].startSec, 10.3);
  assert.equal(expanded[4].endSec, 20.3);
});
