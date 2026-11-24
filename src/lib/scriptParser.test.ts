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
      speaker: 'Contador de Histórias',
      role: 'narrator',
      style: 'Calmo',
      text: 'Durante todo o verão ensolarado, a cigarra cantou feliz entre os galhos.',
      pauseAfterMs: 300,
    },
  ];

  const keyA = computeChapterCacheKey({
    chapterId: 'esopo-cigarra-formiga',
    mode: 'dramatized',
    turns,
    voiceMap: { 'Contador de Histórias': 'Charon' },
  });
  const keyB = computeChapterCacheKey({
    chapterId: 'esopo-cigarra-formiga',
    mode: 'dramatized',
    turns,
    voiceMap: { 'Contador de Histórias': 'Charon' },
  });
  const keyDifferentVoice = computeChapterCacheKey({
    chapterId: 'esopo-cigarra-formiga',
    mode: 'dramatized',
    turns,
    voiceMap: { 'Contador de Histórias': 'Fenrir' },
  });
  const keySoloMode = computeChapterCacheKey({
    chapterId: 'esopo-cigarra-formiga',
    mode: 'narrator',
    turns,
    voiceMap: { 'Contador de Histórias': 'Charon' },
  });

  assert.equal(keyA, keyB);
  assert.notEqual(keyA, keyDifferentVoice);
  assert.notEqual(keyA, keySoloMode);
});

test('findActiveSegmentIndex resolves exact active turn and holds highlight during inter-turn silence', () => {
  const segments: AudioSegmentTiming[] = [
    { turnId: 't1', speaker: 'Contador de Histórias', voiceName: 'Charon', startSec: 0, endSec: 5.0 },
    { turnId: 't2', speaker: 'A Cigarra', voiceName: 'Zephyr', startSec: 5.3, endSec: 7.2 },
    { turnId: 't3', speaker: 'A Formiga', voiceName: 'Kore', startSec: 7.5, endSec: 12.0 },
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
    speaker: 'A Lebre',
    role: 'character',
    style: 'Saltitante',
    text: 'Já cheguei na frente!',
  };
  assert.equal(
    resolveVoiceForTurn(turn, { 'A Lebre': 'Puck' }, 'dramatized', 'Charon'),
    'Puck',
  );
  assert.equal(
    resolveVoiceForTurn(turn, { 'A Lebre': 'Puck' }, 'narrator', 'Charon'),
    'Charon',
  );
});

test('batchTurnsForTts groups multi-character fables into minimal 1- or 2-speaker TTS calls', () => {
  const turns: ScriptTurn[] = [
    { id: 't1', speaker: 'Contador de Histórias', role: 'narrator', style: 'Calmo', text: 'Era uma vez na floresta.' },
    { id: 't2', speaker: 'A Cigarra', role: 'character', style: 'Alegre', text: 'Venha cantar comigo!' },
    { id: 't3', speaker: 'Contador de Histórias', role: 'narrator', style: 'Sereno', text: 'A formiga sorriu e respondeu.' },
    { id: 't4', speaker: 'A Formiga', role: 'character', style: 'Gentil', text: 'Preciso guardar sementes para o inverno.' },
    { id: 't5', speaker: 'Contador de Histórias', role: 'narrator', style: 'Instrutivo', text: 'E assim todos aprenderam a lição.' },
  ];

  const batches = batchTurnsForTts(
    turns,
    { 'Contador de Histórias': 'Charon', 'A Cigarra': 'Zephyr', 'A Formiga': 'Kore' },
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

test('expandBatchTimingsToTurns snaps split boundaries to detected PCM silences inside multi-turn batches', () => {
  const turns: ScriptTurn[] = [
    { id: 't1', speaker: 'Contador de Histórias', role: 'narrator', style: 'Lento', text: 'Fala curta.' },
    {
      id: 't2',
      speaker: 'A Cigarra',
      role: 'character',
      style: 'Rápido',
      text: 'Uma fala muito mais longa dita rapidamente pela cigarra na floresta ensolarada.',
    },
  ];

  const batches = batchTurnsForTts(
    turns,
    { 'Contador de Histórias': 'Charon', 'A Cigarra': 'Zephyr' },
    'dramatized',
    'Charon',
  );
  assert.equal(batches.length, 1);

  // Text proportionality would guess ~1.5s inside a 10s clip, but real PCM silence sits at 4.2s
  const expanded = expandBatchTimingsToTurns(
    batches,
    [{ id: 'batch-1', startSec: 2.0, endSec: 12.0 }],
    [[{ timeSec: 4.2, durationMs: 360 }]],
  );

  assert.equal(expanded.length, 2);
  assert.equal(expanded[0].startSec, 2.0);
  assert.equal(expanded[0].endSec, 6.2);
  assert.equal(expanded[1].startSec, 6.2);
  assert.equal(expanded[1].endSec, 12.0);
});
