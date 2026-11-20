import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChapterFromRaw,
  extractGutenbergMetadata,
  filterChapters,
  intToRoman,
  parseDomCasmurroGutenberg,
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

test('parseDomCasmurroGutenberg extracts sequential chapters and excludes boilerplate and INDICE', () => {
  const sample = `Header text
*** START OF THE PROJECT GUTENBERG EBOOK DOM CASMURRO ***

I

Do titulo.

Uma noite destas, vindo da cidade
para o Engenho Novo.

--Continue, disse eu.
--Já acabei, murmurou José Dias.

II.

Do livro.

Agora que expliquei o _titulo_, passo a escrever.

FIM

INDICE

    Capitulo I         Do titulo
             II        Do livro

*** END OF THE PROJECT GUTENBERG EBOOK DOM CASMURRO ***
`;

  const parsed = parseDomCasmurroGutenberg(sample);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].number, 1);
  assert.equal(parsed[0].roman, 'I');
  assert.equal(parsed[0].title, 'Do titulo');
  assert.equal(parsed[0].paragraphs.length, 3);
  assert.equal(parsed[0].paragraphs[0], 'Uma noite destas, vindo da cidade para o Engenho Novo.');
  assert.equal(parsed[0].paragraphs[1], '— Continue, disse eu.');

  assert.equal(parsed[1].number, 2);
  assert.equal(parsed[1].title, 'Do livro');
  assert.equal(parsed[1].paragraphs.length, 1);
  assert.equal(parsed[1].paragraphs[0], 'Agora que expliquei o titulo, passo a escrever.');
});

test('parsePublicDomainBookText handles CAPITULO headings, OCR typo CAPIULO, front-matter TOC, and plain imports', () => {
  const brasSample = `Title: Memorias Posthumas de Braz Cubas
Author: Machado de Assis
Language: Portuguese
*** START OF THE PROJECT GUTENBERG EBOOK MEMORIAS ***

CAPITULO I
CAPITULO II

CAPITULO I

Obito do autor

Algum tempo hesitei se devia abrir estas memorias pelo principio ou pelo fim.

CAPIULO II

O emplasto

Com effeito, um dia de manhã, passeando na chacara, pendurou-se-me uma idéa no trapezio.

--Que grande idéa! exclamou Virgilia.

FIM

ÍNDICE
I Obito do autor
*** END OF THE PROJECT GUTENBERG EBOOK MEMORIAS ***
`;

  const meta = extractGutenbergMetadata(brasSample);
  assert.equal(meta.title, 'Memorias Posthumas de Braz Cubas');
  assert.equal(meta.author, 'Machado de Assis');

  const parsed = parsePublicDomainBookText(brasSample);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].title, 'Obito do autor');
  assert.equal(parsed[1].title, 'O emplasto');

  const ch2 = buildChapterFromRaw(parsed[1], 'bras-cubas');
  assert.equal(ch2.id, 'bc-cap-2');
  assert.equal(ch2.turns[0].speaker, 'Brás Cubas (Narrador)');
  assert.equal(ch2.turns[1].speaker, 'Virgília');

  const customMd = `# Prólogo\n\nEra uma tarde tranquila no Rio.\n\n# A Carta\n\n— Chegou o correio, disse a criada.`;
  const parsedMd = parsePublicDomainBookText(customMd);
  assert.equal(parsedMd.length, 2);
  assert.equal(parsedMd[0].title, 'Prólogo');
  assert.equal(parsedMd[1].title, 'A Carta');
  assert.equal(slugifyBookId('Memórias Póstumas!'), 'memorias-postumas');
});

test('buildChapterFromRaw detects recurring Dom Casmurro characters in dialogue turns', () => {
  const chapter = buildChapterFromRaw({
    number: 32,
    roman: 'XXXII',
    title: 'Olhos de ressaca',
    wordCount: 42,
    paragraphs: [
      'Capitu olhou para mim longamente na sala.',
      '— Que tens, Bentinho? perguntou Capitu.',
      '— Nada, respondi eu com voz baixa.',
    ],
  });

  assert.equal(chapter.id, 'dc-cap-32');
  assert.equal(chapter.hasDialogue, true);
  assert.equal(chapter.turns.length, 3);
  assert.equal(chapter.turns[0].speaker, 'Bentinho (Narrador)');
  assert.equal(chapter.turns[1].speaker, 'Capitu');
  assert.equal(chapter.turns[2].speaker, 'Bentinho (Narrador)');
  assert.ok(chapter.characters.some((c) => c.name === 'Capitu' && c.defaultVoice === 'Zephyr'));
});

test('filterChapters matches by Arabic number, Roman numeral, accent-insensitive title, and cached filter', () => {
  const list: ChapterSummary[] = [
    {
      id: 'dc-cap-1',
      bookId: 'dom-casmurro',
      number: 1,
      roman: 'I',
      numberLabel: 'Capítulo I',
      title: 'Do Título',
      estimatedMinutes: 3,
      wordCount: 360,
      characterCount: 3,
      hasDialogue: true,
    },
    {
      id: 'dc-cap-32',
      bookId: 'dom-casmurro',
      number: 32,
      roman: 'XXXII',
      numberLabel: 'Capítulo XXXII',
      title: 'Olhos de ressaca',
      estimatedMinutes: 4,
      wordCount: 520,
      characterCount: 2,
      hasDialogue: true,
    },
  ];
  const cached = new Set(['dc-cap-1']);

  assert.equal(filterChapters(list, 'titulo', cached, false).length, 1);
  assert.equal(filterChapters(list, '32', cached, false)[0]?.id, 'dc-cap-32');
  assert.equal(filterChapters(list, 'xxxii', cached, false)[0]?.id, 'dc-cap-32');
  assert.equal(filterChapters(list, '', cached, true).length, 1);
  assert.equal(filterChapters(list, 'ressaca', cached, true).length, 0);
});
