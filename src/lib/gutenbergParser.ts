import type { Chapter, ChapterCharacter, ChapterSummary, ScriptTurn } from '../types';

const ROMAN_RE = /^(M{0,3})(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})\.?$/;
const CAP_ROMAN_RE = /^(?:CAP[IÍ]T?ULO|CAP\.?|PARTE|F[ÁA]BULA|CONTO|HIST[ÓO]RIA)\s+([IVXLCDM]+)(?:\s*[-—–:.]\s*(.+))?\.?$/i;
const CAP_ARABIC_RE = /^(?:CAP[IÍ]T?ULO|CAP\.?|PARTE|F[ÁA]BULA|CONTO|HIST[ÓO]RIA)\s+(\d{1,3})(?:\s*[-—–:.]\s*(.+))?\.?$/i;
const MARKDOWN_HEADING_RE = /^#{1,3}\s+(.+)$/;

export interface ParsedRawChapter {
  number: number;
  roman: string;
  title: string;
  paragraphs: string[];
  wordCount: number;
}

export function intToRoman(num: number): string {
  if (!Number.isFinite(num) || num <= 0) return String(num);
  const table: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let remaining = Math.floor(num);
  let out = '';
  for (const [value, symbol] of table) {
    while (remaining >= value) {
      out += symbol;
      remaining -= value;
    }
  }
  return out;
}

export function romanToInt(roman: string): number {
  const clean = roman.trim().replace(/\.$/, '').toUpperCase();
  if (!clean || !ROMAN_RE.test(clean)) return 0;
  const map: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };
  let total = 0;
  for (let i = 0; i < clean.length; i++) {
    const cur = map[clean[i]];
    const next = map[clean[i + 1]] ?? 0;
    if (!cur) return 0;
    total += cur < next ? -cur : cur;
  }
  return total;
}

function cleanLineText(text: string): string {
  return text
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^--\s*/, '— ')
    .replace(/\s+--\s*/g, ' — ')
    .replace(/--/g, ' — ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanChapterTitle(title: string): string {
  const cleaned = cleanLineText(title);
  return cleaned.endsWith('.') && !cleaned.endsWith('...')
    ? cleaned.slice(0, -1).trim()
    : cleaned;
}

export function extractGutenbergMetadata(rawText: string): {
  title?: string;
  author?: string;
  language?: string;
} {
  const header = rawText.slice(0, 3500).replace(/\r\n/g, '\n');
  const titleMatch = header.match(/^Title:\s*(.+)$/im);
  const authorMatch = header.match(/^Author:\s*(.+)$/im);
  const langMatch = header.match(/^Language:\s*(.+)$/im);
  return {
    title: titleMatch?.[1]?.trim(),
    author: authorMatch?.[1]?.trim(),
    language: langMatch?.[1]?.trim(),
  };
}

function stripGutenbergBoilerplate(rawText: string): string[] {
  const normalized = rawText.replace(/\r\n/g, '\n');
  const startMarker = '*** START OF THE PROJECT GUTENBERG EBOOK';
  const endMarker = '*** END OF THE PROJECT GUTENBERG EBOOK';

  const startIdx = normalized.indexOf(startMarker);
  const bodyStart = startIdx >= 0 ? normalized.indexOf('\n', startIdx) + 1 : 0;
  const endIdx = normalized.indexOf(endMarker);
  const rawBody = endIdx >= 0 ? normalized.slice(bodyStart, endIdx) : normalized.slice(bodyStart);

  const lines = rawBody.split('\n');

  // Stop at the standalone "FIM" marker only if it appears in the latter 35% of the file
  let stopLine = lines.length;
  const minFimLine = Math.floor(lines.length * 0.6);
  for (let i = lines.length - 1; i >= minFimLine; i--) {
    const trimmed = lines[i].trim().toUpperCase();
    if (trimmed === 'FIM' || trimmed === 'FIM.') {
      stopLine = i;
      break;
    }
  }
  return lines.slice(0, stopLine);
}

interface HeadingCandidate {
  lineIndex: number;
  number: number;
  roman: string;
  inlineTitle?: string;
  kind: 'cap-roman' | 'cap-arabic' | 'bare-roman' | 'markdown';
}

function parseParagraphsFromLines(contentLines: string[]): string[] {
  const paragraphs: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length > 0) {
      const joined = cleanLineText(buffer.join(' '));
      if (joined.length > 0) {
        paragraphs.push(joined);
      }
      buffer = [];
    }
  };

  for (const line of contentLines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      flush();
    } else if (trimmed.startsWith('--') || trimmed.startsWith('—')) {
      flush();
      buffer.push(trimmed);
    } else {
      buffer.push(trimmed);
    }
  }
  flush();

  return paragraphs;
}

function isLikelySubtitleLine(blockLines: string[]): boolean {
  if (blockLines.length === 0 || blockLines.length > 2) return false;
  const joined = cleanLineText(blockLines.join(' '));
  if (!joined || joined.length > 96) return false;
  if (joined.startsWith('—') || joined.startsWith('--')) return false;
  // Titles rarely contain multiple sentences or end with commas/semicolons
  if (/[,;:]$/.test(joined)) return false;
  const sentenceBreaks = joined.match(/[.!?]\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/g);
  if (sentenceBreaks && sentenceBreaks.length >= 2) return false;
  return true;
}

/**
 * General-purpose chapter splitter for Portuguese Project Gutenberg books and imported texts.
 * Automatically ignores front-matter TOCs, handles "CAPITULO I", "CAPIULO CXXIV" OCR typos,
 * standalone Roman numerals, Arabic chapter numbers, Markdown headings, and plain texts without headings.
 */
export function parsePublicDomainBookText(rawText: string): ParsedRawChapter[] {
  const bookLines = stripGutenbergBoilerplate(rawText);

  const candidates: HeadingCandidate[] = [];

  for (let i = 0; i < bookLines.length; i++) {
    const trimmed = bookLines[i].trim();
    if (!trimmed || trimmed.length > 110) continue;

    const prevBlank = i === 0 || bookLines[i - 1].trim() === '';
    const nextBlank = i === bookLines.length - 1 || bookLines[i + 1].trim() === '';

    // 1. "CAPITULO I", "CAPÍTULO CLIII", "CAPIULO CXXIV", "Capítulo 1 — Título"
    const capRoman = trimmed.match(CAP_ROMAN_RE);
    if (capRoman && prevBlank && nextBlank) {
      const num = romanToInt(capRoman[1]);
      if (num > 0) {
        candidates.push({
          lineIndex: i,
          number: num,
          roman: capRoman[1].toUpperCase(),
          inlineTitle: capRoman[2]?.trim(),
          kind: 'cap-roman',
        });
        continue;
      }
    }

    const capArabic = trimmed.match(CAP_ARABIC_RE);
    if (capArabic && prevBlank && nextBlank) {
      const num = Number.parseInt(capArabic[1], 10);
      if (num > 0) {
        candidates.push({
          lineIndex: i,
          number: num,
          roman: intToRoman(num),
          inlineTitle: capArabic[2]?.trim(),
          kind: 'cap-arabic',
        });
        continue;
      }
    }

    // 2. Standalone Roman numeral surrounded by blank lines (e.g. Dom Casmurro, Iracema)
    if (trimmed.length <= 12 && ROMAN_RE.test(trimmed) && prevBlank && nextBlank) {
      const num = romanToInt(trimmed);
      if (num > 0) {
        candidates.push({
          lineIndex: i,
          number: num,
          roman: trimmed.replace(/\.$/, '').toUpperCase(),
          kind: 'bare-roman',
        });
        continue;
      }
    }

    // 3. Markdown headings for user-imported .md/.txt files
    const mdMatch = trimmed.match(MARKDOWN_HEADING_RE);
    if (mdMatch && prevBlank) {
      candidates.push({
        lineIndex: i,
        number: candidates.length + 1,
        roman: intToRoman(candidates.length + 1),
        inlineTitle: mdMatch[1].trim(),
        kind: 'markdown',
      });
    }
  }

  // Filter out TOC entries: a real chapter heading must be followed by non-heading text
  // before the next heading candidate (or be the final chapter).
  const isSubstantive = (idx: number, nextLine: number): boolean => {
    let nonEmptyLines = 0;
    for (let l = idx + 1; l < nextLine; l++) {
      if (bookLines[l].trim().length > 0) {
        nonEmptyLines++;
        if (nonEmptyLines >= 1) return true;
      }
    }
    return false;
  };

  // Find the best sequential chapter chain (1, 2, 3...) across numbered candidates
  const numberedCandidates = candidates.filter((c) => c.kind !== 'markdown');
  let bestChain: HeadingCandidate[] = [];

  for (let start = 0; start < numberedCandidates.length; start++) {
    if (numberedCandidates[start].number !== 1) continue;
    const chain: HeadingCandidate[] = [];
    let expected = 1;
    for (let k = start; k < numberedCandidates.length; k++) {
      const cand = numberedCandidates[k];
      if (cand.number !== expected) continue;
      // Check it isn't immediately adjacent (within 2 lines) to the next numbered candidate (TOC table)
      const nextCandLine =
        k + 1 < numberedCandidates.length ? numberedCandidates[k + 1].lineIndex : bookLines.length;
      if (nextCandLine - cand.lineIndex <= 2 && expected <= 3) {
        continue;
      }
      if (!isSubstantive(cand.lineIndex, nextCandLine)) {
        continue;
      }
      chain.push(cand);
      expected++;
    }
    if (chain.length > bestChain.length) {
      bestChain = chain;
    }
  }

  // If numbered chain failed (e.g. a collection of short stories or Markdown file), try Markdown headings
  let selectedMarkers = bestChain;
  if (selectedMarkers.length < 2) {
    const mdCandidates = candidates.filter((c) => c.kind === 'markdown');
    if (mdCandidates.length >= 1) {
      selectedMarkers = mdCandidates.map((c, idx) => ({
        ...c,
        number: idx + 1,
        roman: intToRoman(idx + 1),
      }));
    }
  }

  // Fallback: no chapter headings found — split long text into clean reading sections (~1,100 words)
  if (selectedMarkers.length === 0) {
    const allParagraphs = parseParagraphsFromLines(bookLines);
    if (allParagraphs.length === 0) return [];

    const totalWords = allParagraphs.reduce(
      (acc, p) => acc + p.split(/\s+/).filter(Boolean).length,
      0,
    );

    if (totalWords <= 1800) {
      return [
        {
          number: 1,
          roman: 'I',
          title: 'Texto integral',
          paragraphs: allParagraphs,
          wordCount: totalWords,
        },
      ];
    }

    const sections: ParsedRawChapter[] = [];
    let currentParas: string[] = [];
    let currentWords = 0;

    for (const para of allParagraphs) {
      const words = para.split(/\s+/).filter(Boolean).length;
      if (currentWords > 0 && currentWords + words > 1100) {
        const num = sections.length + 1;
        sections.push({
          number: num,
          roman: intToRoman(num),
          title: `Parte ${intToRoman(num)}`,
          paragraphs: currentParas,
          wordCount: currentWords,
        });
        currentParas = [];
        currentWords = 0;
      }
      currentParas.push(para);
      currentWords += words;
    }

    if (currentParas.length > 0) {
      const num = sections.length + 1;
      sections.push({
        number: num,
        roman: intToRoman(num),
        title: `Parte ${intToRoman(num)}`,
        paragraphs: currentParas,
        wordCount: currentWords,
      });
    }
    return sections;
  }

  const chapters: ParsedRawChapter[] = [];

  for (let idx = 0; idx < selectedMarkers.length; idx++) {
    const current = selectedMarkers[idx];
    const nextHeadingLine =
      idx + 1 < selectedMarkers.length ? selectedMarkers[idx + 1].lineIndex : bookLines.length;

    let bodyStartLine = current.lineIndex + 1;
    let title = current.inlineTitle ? cleanChapterTitle(current.inlineTitle) : '';

    if (!title) {
      // Inspect first non-empty block after the chapter heading to see if it's a chapter subtitle
      let j = bodyStartLine;
      while (j < nextHeadingLine && bookLines[j].trim() === '') {
        j++;
      }
      const firstBlock: string[] = [];
      let blockEnd = j;
      while (blockEnd < nextHeadingLine && bookLines[blockEnd].trim() !== '') {
        firstBlock.push(bookLines[blockEnd].trim());
        blockEnd++;
      }

      // Only treat the first block as a subtitle if there is more content after it in the chapter
      let hasMoreContent = false;
      for (let k = blockEnd; k < nextHeadingLine; k++) {
        if (bookLines[k].trim() !== '') {
          hasMoreContent = true;
          break;
        }
      }

      if (hasMoreContent && isLikelySubtitleLine(firstBlock)) {
        title = cleanChapterTitle(firstBlock.join(' '));
        bodyStartLine = blockEnd;
      } else {
        title = `História ${current.roman}`;
      }
    }

    const contentLines = bookLines.slice(bodyStartLine, nextHeadingLine);
    let paragraphs = parseParagraphsFromLines(contentLines);

    if (paragraphs.length === 0) {
      paragraphs = ['...'];
    }

    const wordCount = paragraphs.reduce(
      (acc, p) => acc + p.split(/\s+/).filter(Boolean).length,
      0,
    );

    chapters.push({
      number: current.number,
      roman: current.roman,
      title: title || `História ${current.roman}`,
      paragraphs,
      wordCount,
    });
  }

  return chapters;
}

interface BookPersonaProfile {
  chapterIdPrefix: string;
  narrator: ChapterCharacter;
  fallbackSummaryBookTitle: string;
}

function getBookPersonaProfile(
  bookId: string,
  options?: { bookTitle?: string; narratorName?: string },
): BookPersonaProfile {
  const cleanPrefix = bookId.replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'fabula';
  return {
    chapterIdPrefix: `${cleanPrefix}-h`,
    narrator: {
      name: options?.narratorName?.trim() || 'Contador de Histórias',
      role: 'narrator',
      description: 'Voz principal da narrativa em português brasileiro.',
      defaultVoice: 'Charon',
      defaultStyle:
        'Contador de histórias brasileiro, voz calorosa, cadência envolvente e dicção clara',
    },
    fallbackSummaryBookTitle: options?.bookTitle || 'esta coleção',
  };
}

/**
 * Converts a parsed raw story/chapter into a structured Chapter ready for instant reading
 * and immediate multi-voice synthesis.
 */
export function buildChapterFromRaw(
  raw: ParsedRawChapter,
  bookId = 'fabulas-personalizadas',
  options?: { bookTitle?: string; narratorName?: string },
): Chapter {
  const profile = getBookPersonaProfile(bookId, options);
  const chapterId = `${profile.chapterIdPrefix}-${raw.number}`;
  const narratorCharacter = profile.narrator;

  const characterMap = new Map<string, ChapterCharacter>();
  characterMap.set(narratorCharacter.name, narratorCharacter);

  const turns: ScriptTurn[] = [];
  let hasDialogue = false;

  for (let i = 0; i < raw.paragraphs.length; i++) {
    const paragraph = raw.paragraphs[i];
    const isDialogue = paragraph.startsWith('—');

    if (!isDialogue) {
      turns.push({
        id: `${chapterId}-t${i + 1}`,
        speaker: narratorCharacter.name,
        role: 'narrator',
        style: narratorCharacter.defaultStyle,
        text: paragraph,
        pauseAfterMs: 320,
      });
      continue;
    }

    hasDialogue = true;
    const spokenText = paragraph.replace(/^—\s*/, '').trim();
    const fallbackName = 'Personagem';
    if (!characterMap.has(fallbackName)) {
      characterMap.set(fallbackName, {
        name: fallbackName,
        role: 'character',
        description: 'Voz de personagem em diálogo nesta história.',
        defaultVoice: 'Puck',
        defaultStyle: 'Personagem brasileiro em diálogo natural e expressivo',
      });
    }
    turns.push({
      id: `${chapterId}-t${i + 1}`,
      speaker: fallbackName,
      role: 'character',
      style: 'Personagem brasileiro em diálogo natural e expressivo',
      text: spokenText,
      pauseAfterMs: 240,
    });
  }

  const firstReadable = raw.paragraphs.find((p) => /[a-zA-ZÀ-ÿ]{3,}/.test(p)) ?? '';
  const firstSentence =
    firstReadable.split(/(?<=[.!?])\s+/)[0]?.slice(0, 165).trim() ||
    `História ${raw.roman} de ${profile.fallbackSummaryBookTitle}.`;
  const summary =
    firstSentence.length >= 165 ? `${firstSentence.replace(/[,\s]+$/, '')}…` : firstSentence;

  const characters = Array.from(characterMap.values());

  return {
    id: chapterId,
    bookId,
    number: raw.number,
    roman: raw.roman,
    numberLabel: `História ${raw.roman}`,
    title: raw.title,
    estimatedMinutes: Math.max(1, Math.round(raw.wordCount / 140)),
    wordCount: raw.wordCount,
    characterCount: characters.length,
    hasDialogue,
    dramatizedByAi: false,
    summary,
    characters,
    turns,
  };
}

export function slugifyBookId(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
  return base || `livro-${Date.now()}`;
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Filters a book's chapter list by chapter number, Roman numeral, title text,
 * or cached-only toggle for snappy multi-hundred-chapter mobile browsing.
 */
export function filterChapters(
  chapters: ChapterSummary[],
  query: string,
  cachedChapterIds: Set<string>,
  onlyCached: boolean,
): ChapterSummary[] {
  const q = normalizeSearchText(query);
  return chapters.filter((ch) => {
    if (onlyCached && !cachedChapterIds.has(ch.id)) {
      return false;
    }
    if (!q) return true;
    const haystack = normalizeSearchText(
      `${ch.number} ${ch.roman} ${ch.numberLabel} ${ch.title}`,
    );
    return haystack.includes(q);
  });
}
