import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChapterFromRaw,
  extractGutenbergMetadata,
  filterChapters,
  intToRoman,
  parsePublicDomainBookText,
  romanToInt,
  slugifyBookId,
} from './gutenbergParser';
import type { ChapterSummary } from '../types';

test('romanToInt and intToRoman roundtrip numerals I through CLX', () => {
  assert.equal(romanToInt('I'), 1);
  assert.equal(romanToInt('II.'), 2);
  assert.equal(romanToInt('XXXII'), 32);
  assert.equal(romanToInt('XCIV'), 94);
  assert.equal(romanToInt('CXLVIII'), 148);
  assert.equal(romanToInt('CLX'), 160);
  assert.equal(intToRoman(160), 'CLX');
  assert.equal(intToRoman(124), 'CXXIV');
});

test('parsePublicDomainBookText extracts sequential stories and excludes Gutenberg boilerplate and INDICE', () => {
  const sample = `Header text
*** START OF THE PROJECT GUTENBERG EBOOK FABULAS DE ESOPO ***

I

A Cigarra e a Formiga.

Durante todo o verão, a cigarra cantou
entre os galhos da floresta.

--Por que trabalha tanto? perguntou a cigarra.
--Guardo alimento para o inverno, respondeu a formiga.

II.

A Lebre e a Tartaruga.

Agora a corrida _começou_ pelo bosque.

FIM

INDICE

    Fabula I         A Cigarra e a Formiga
           II        A Lebre e a Tartaruga

*** END OF THE PROJECT GUTENBERG EBOOK FABULAS DE ESOPO ***
`;

  const parsed = parsePublicDomainBookText(sample);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].number, 1);
  assert.equal(parsed[0].roman, 'I');
  assert.equal(parsed[0].title, 'A Cigarra e a Formiga');
  assert.equal(parsed[0].paragraphs.length, 3);
  assert.equal(
    parsed[0].paragraphs[0],
    'Durante todo o verão, a cigarra cantou entre os galhos da floresta.',
  );
  assert.equal(parsed[0].paragraphs[1], '— Por que trabalha tanto? perguntou a cigarra.');

  assert.equal(parsed[1].number, 2);
  assert.equal(parsed[1].title, 'A Lebre e a Tartaruga');
  assert.equal(parsed[1].paragraphs.length, 1);
  assert.equal(parsed[1].paragraphs[0], 'Agora a corrida começou pelo bosque.');
});

test('parsePublicDomainBookText handles FABULA/CONTO headings, front-matter TOC, and Markdown imports', () => {
  const fablesSample = `Title: Fabulas de La Fontaine
Author: Jean de La Fontaine
Language: Portuguese
*** START OF THE PROJECT GUTENBERG EBOOK FABULAS ***

FABULA I
FABULA II

FABULA I

O Lobo e o Cordeiro

Um pequeno Cordeiro bebia água no riacho cristalino.

FABULA II

O Patinho Feio

Em uma manhã ensolarada, os ovos começaram a abrir.

--Que grande patinho! disse a mãe pata.

FIM

ÍNDICE
I O Lobo e o Cordeiro
*** END OF THE PROJECT GUTENBERG EBOOK FABULAS ***
`;

  const meta = extractGutenbergMetadata(fablesSample);
  assert.equal(meta.title, 'Fabulas de La Fontaine');
  assert.equal(meta.author, 'Jean de La Fontaine');

  const parsed = parsePublicDomainBookText(fablesSample);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].title, 'O Lobo e o Cordeiro');
  assert.equal(parsed[1].title, 'O Patinho Feio');

  const ch2 = buildChapterFromRaw(parsed[1], 'fabulas-la-fontaine');
  assert.equal(ch2.id, 'fabulas-la-fontaine-h-2');
  assert.equal(ch2.numberLabel, 'História II');
  assert.equal(ch2.turns[0].speaker, 'Contador de Histórias');
  assert.equal(ch2.turns[1].speaker, 'Personagem');

  const customMd = `# A Cigarra e a Formiga\n\nEra uma tarde ensolarada no bosque.\n\n# O Leão e o Ratinho\n\n— Obrigado por me soltar, disse o leão.`;
  const parsedMd = parsePublicDomainBookText(customMd);
  assert.equal(parsedMd.length, 2);
  assert.equal(parsedMd[0].title, 'A Cigarra e a Formiga');
  assert.equal(parsedMd[1].title, 'O Leão e o Ratinho');
  assert.equal(slugifyBookId('Fábulas da Floresta!'), 'fabulas-da-floresta');
});

test('buildChapterFromRaw structures narrator and character dialogue turns cleanly', () => {
  const chapter = buildChapterFromRaw(
    {
      number: 3,
      roman: 'III',
      title: 'O Leão e o Ratinho',
      wordCount: 38,
      paragraphs: [
        'Um pequeno ratinho acordou o grande leão da floresta.',
        '— Por favor, não me devore! pediu o ratinho.',
        '— Pois bem, pode ir, respondeu o leão sorrindo.',
      ],
    },
    'fabulas-esopo',
  );

  assert.equal(chapter.id, 'fabulas-esopo-h-3');
  assert.equal(chapter.hasDialogue, true);
  assert.equal(chapter.turns.length, 3);
  assert.equal(chapter.turns[0].speaker, 'Contador de Histórias');
  assert.equal(chapter.turns[1].speaker, 'Personagem');
  assert.equal(chapter.turns[2].speaker, 'Personagem');
  assert.ok(chapter.characters.some((c) => c.name === 'Contador de Histórias' && c.defaultVoice === 'Charon'));
});

test('filterChapters matches by Arabic number, Roman numeral, accent-insensitive title, and cached filter', () => {
  const list: ChapterSummary[] = [
    {
      id: 'esopo-cigarra-formiga',
      bookId: 'fabulas-esopo',
      number: 1,
      roman: 'I',
      numberLabel: 'Fábula I',
      title: 'A Cigarra e a Formiga',
      estimatedMinutes: 2,
      wordCount: 220,
      characterCount: 3,
      hasDialogue: true,
    },
    {
      id: 'esopo-leao-ratinho',
      bookId: 'fabulas-esopo',
      number: 3,
      roman: 'III',
      numberLabel: 'Fábula III',
      title: 'O Leão e o Ratinho',
      estimatedMinutes: 2,
      wordCount: 250,
      characterCount: 3,
      hasDialogue: true,
    },
  ];
  const cached = new Set(['esopo-cigarra-formiga']);

  assert.equal(filterChapters(list, 'cigarra', cached, false).length, 1);
  assert.equal(filterChapters(list, '3', cached, false)[0]?.id, 'esopo-leao-ratinho');
  assert.equal(filterChapters(list, 'iii', cached, false)[0]?.id, 'esopo-leao-ratinho');
  assert.equal(filterChapters(list, '', cached, true).length, 1);
  assert.equal(filterChapters(list, 'ratinho', cached, true).length, 0);
});
