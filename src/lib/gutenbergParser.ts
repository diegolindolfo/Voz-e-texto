import type { Chapter, ChapterCharacter, ChapterSummary, PrebuiltVoiceName, ScriptTurn } from '../types';

const ROMAN_RE = /^(M{0,3})(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})\.?$/;
const CAP_ROMAN_RE = /^(?:CAP[IÍ]T?ULO|CAP\.?|PARTE)\s+([IVXLCDM]+)(?:\s*[-—–:.]\s*(.+))?\.?$/i;
const CAP_ARABIC_RE = /^(?:CAP[IÍ]T?ULO|CAP\.?|PARTE)\s+(\d{1,3})(?:\s*[-—–:.]\s*(.+))?\.?$/i;
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
        title = `Capítulo ${current.roman}`;
      }
    }

    const contentLines = bookLines.slice(bodyStartLine, nextHeadingLine);
    let paragraphs = parseParagraphsFromLines(contentLines);

    // Handle famous experimental punctuation-only chapters (e.g. Brás Cubas CXXXIX)
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
      title: title || `Capítulo ${current.roman}`,
      paragraphs,
      wordCount,
    });
  }

  return chapters;
}

/**
 * Backward-compatible alias used by Dom Casmurro tests and tooling.
 */
export function parseDomCasmurroGutenberg(rawText: string): ParsedRawChapter[] {
  return parsePublicDomainBookText(rawText);
}

interface KnownPersona {
  name: string;
  patterns: RegExp[];
  voice: PrebuiltVoiceName;
  description: string;
  style: string;
}

interface BookPersonaProfile {
  chapterIdPrefix: string;
  narrator: ChapterCharacter;
  personas: KnownPersona[];
  fallbackSummaryBookTitle: string;
}

const DOM_CASMURRO_PERSONAS: KnownPersona[] = [
  {
    name: 'Capitu',
    patterns: [/\bcapit[uú]\b/i],
    voice: 'Zephyr',
    description: 'Vizinha e grande amor de Bentinho, perspicaz e expressiva.',
    style: 'Voz feminina jovem e vivaz em português brasileiro, olhar atento e firmeza serena',
  },
  {
    name: 'José Dias',
    patterns: [/\bjos[ée]\s+dias\b/i, /\baggregado\b/i, /\bagregado\b/i],
    voice: 'Fenrir',
    description: 'Agregado da família, solene, diplomático e amante de superlativos.',
    style: 'Homem brasileiro formal e solene, voz grave e enfática com pausas teatrais',
  },
  {
    name: 'Dona Glória',
    patterns: [/\bd\.\s*gl[óo]ria\b/i, /\bdona\s+gl[óo]ria\b/i, /\bmamãe\b/i, /\bminha\s+mãe\b/i],
    voice: 'Kore',
    description: 'Mãe de Bentinho, piedosa, carinhosa e fiel à promessa do seminário.',
    style: 'Senhora brasileira terna e serena, voz acolhedora e delicada',
  },
  {
    name: 'Escobar',
    patterns: [/\bescobar\b/i, /\bezequiel\s+de\s+sousa\b/i],
    voice: 'Puck',
    description: 'Amigo íntimo do seminário, articulado, inteligente e cortês.',
    style: 'Homem brasileiro jovem e articulado, tom cordial e persuasivo',
  },
  {
    name: 'Tio Cosme',
    patterns: [/\btio\s+cosme\b/i, /\bcosme\b/i],
    voice: 'Fenrir',
    description: 'Tio advogado, bonachão, irônico e bem-humorado.',
    style: 'Voz masculina madura e bem-humorada, tom descontraído e sonoro',
  },
  {
    name: 'Prima Justina',
    patterns: [/\bprima\s+justina\b/i, /\bjustina\b/i],
    voice: 'Kore',
    description: 'Parenta franca, observadora e de comentários secos.',
    style: 'Voz feminina madura, franca e levemente seca',
  },
  {
    name: 'Pádua',
    patterns: [/\bp[áa]dua\b/i, /\btartaruga\b/i],
    voice: 'Fenrir',
    description: 'Pai de Capitu, emotivo, modesto e falante.',
    style: 'Voz masculina calorosa e expansiva, tom humilde e emotivo',
  },
  {
    name: 'Sancha',
    patterns: [/\bsancha\b/i],
    voice: 'Kore',
    description: 'Amiga de Capitu e esposa de Escobar, gentil e reservada.',
    style: 'Voz feminina suave, educada e serena',
  },
  {
    name: 'Ezequiel',
    patterns: [/\bezequiel\b/i],
    voice: 'Puck',
    description: 'Filho de Bento e Capitu, curioso e enérgico.',
    style: 'Voz jovem, curiosa e espontânea',
  },
];

const BRAS_CUBAS_PERSONAS: KnownPersona[] = [
  {
    name: 'Virgília',
    patterns: [/\bvirg[íi]lia\b/i],
    voice: 'Zephyr',
    description: 'Grande paixão de Brás Cubas, elegante, apaixonada e ambiciosa.',
    style: 'Voz feminina brasileira elegante, envolvente e levemente maliciosa',
  },
  {
    name: 'Quincas Borba',
    patterns: [/\bquincas\s+borba\b/i, /\bhumanitismo\b/i],
    voice: 'Fenrir',
    description: 'Filósofo excêntrico e criador do Humanitismo, enfático e grandiloquente.',
    style: 'Homem brasileiro teatral e filosófico, voz grave, vibrante e expansiva',
  },
  {
    name: 'Marcela',
    patterns: [/\bmarcel+a\b/i],
    voice: 'Kore',
    description: 'Cortesã espanhola da juventude de Brás Cubas, sedutora e prática.',
    style: 'Voz feminina calorosa, sedutora e segura',
  },
  {
    name: 'Lobo Neves',
    patterns: [/\blobo\s+neves\b/i],
    voice: 'Fenrir',
    description: 'Marido de Virgília e político ambicioso, grave e supersticioso.',
    style: 'Homem brasileiro formal e político, voz firme e comedida',
  },
  {
    name: 'Dona Plácida',
    patterns: [/\bd\.\s*pl[áa]cida\b/i, /\bdona\s+pl[áa]cida\b/i, /\bpl[áa]cida\b/i],
    voice: 'Kore',
    description: 'Confidente humilde e dedicada da casinha da Gamboa.',
    style: 'Senhora brasileira humilde, voz mansa, respeitosa e melancólica',
  },
  {
    name: 'Eugênia',
    patterns: [/\beug[êe]nia\b/i],
    voice: 'Zephyr',
    description: 'A flor da moita na Tijuca, franca, altiva e melancólica.',
    style: 'Jovem brasileira sincera e serena, voz límpida e firme',
  },
  {
    name: 'Cotrim',
    patterns: [/\bcotrim\b/i],
    voice: 'Fenrir',
    description: 'Cunhado de Brás Cubas, seco, metódico e calculista.',
    style: 'Homem brasileiro seco e pragmático, voz direta e contida',
  },
  {
    name: 'Sabina',
    patterns: [/\bsabina\b/i],
    voice: 'Kore',
    description: 'Irmã de Brás Cubas, afetuosa, falante e casamenteira.',
    style: 'Voz feminina expressiva, viva e familiar',
  },
  {
    name: 'Prudêncio',
    patterns: [/\bprud[êe]ncio\b/i],
    voice: 'Puck',
    description: 'Ex-escravizado da casa dos Cubas.',
    style: 'Voz masculina direta e expressiva em português brasileiro',
  },
];

function getBookPersonaProfile(
  bookId: string,
  options?: { bookTitle?: string; narratorName?: string },
): BookPersonaProfile {
  if (bookId === 'dom-casmurro') {
    return {
      chapterIdPrefix: 'dc-cap',
      narrator: {
        name: 'Bentinho (Narrador)',
        role: 'narrator',
        description: 'Voz madura, irônica e contemplativa de Bento Santiago.',
        defaultVoice: 'Charon',
        defaultStyle:
          'Narrador brasileiro culto e maduro, tom intimista, cadência calma e ironia sutil de Machado de Assis',
      },
      personas: DOM_CASMURRO_PERSONAS,
      fallbackSummaryBookTitle: 'Dom Casmurro',
    };
  }

  if (bookId === 'bras-cubas') {
    return {
      chapterIdPrefix: 'bc-cap',
      narrator: {
        name: 'Brás Cubas (Narrador)',
        role: 'narrator',
        description: 'Defunto autor, espirituoso, mordaz e elegante.',
        defaultVoice: 'Charon',
        defaultStyle:
          'Narrador brasileiro espirituoso, irônico e mordaz, conversando diretamente com o leitor com fluência elegante',
      },
      personas: BRAS_CUBAS_PERSONAS,
      fallbackSummaryBookTitle: 'Memórias Póstumas de Brás Cubas',
    };
  }

  const cleanPrefix = bookId.replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'livro';
  return {
    chapterIdPrefix: `${cleanPrefix}-cap`,
    narrator: {
      name: options?.narratorName?.trim() || 'Narrador',
      role: 'narrator',
      description: 'Voz principal da narrativa literária em português brasileiro.',
      defaultVoice: 'Charon',
      defaultStyle:
        'Narrador literário brasileiro, voz natural, cadência envolvente e dicção clara',
    },
    personas: [],
    fallbackSummaryBookTitle: options?.bookTitle || 'esta obra',
  };
}

function detectPersonaInText(text: string, personas: KnownPersona[]): KnownPersona | null {
  for (const persona of personas) {
    if (persona.patterns.some((re) => re.test(text))) {
      return persona;
    }
  }
  return null;
}

/**
 * Converts a parsed raw chapter into a structured Chapter ready for instant reading
 * and immediate multi-voice synthesis, inferring likely dialogue speakers from context.
 */
export function buildChapterFromRaw(
  raw: ParsedRawChapter,
  bookId = 'dom-casmurro',
  options?: { bookTitle?: string; narratorName?: string },
): Chapter {
  const profile = getBookPersonaProfile(bookId, options);
  const chapterId = `${profile.chapterIdPrefix}-${raw.number}`;
  const narratorCharacter = profile.narrator;

  const characterMap = new Map<string, ChapterCharacter>();
  characterMap.set(narratorCharacter.name, narratorCharacter);

  const turns: ScriptTurn[] = [];
  let lastCharacterPersona: KnownPersona | null = null;
  let hasDialogue = false;

  const chapterText = raw.paragraphs.join(' ');
  const chapterLeadPersona = detectPersonaInText(chapterText, profile.personas);

  for (let i = 0; i < raw.paragraphs.length; i++) {
    const paragraph = raw.paragraphs[i];
    const isDialogue = paragraph.startsWith('—');

    if (!isDialogue) {
      const mentioned = detectPersonaInText(paragraph, profile.personas);
      if (mentioned) {
        lastCharacterPersona = mentioned;
      }
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
    const isFirstPersonReply = /\b(disse\s+eu|respondi|perguntei|retorqui|acudi|repliquei|murmurei)\b/i.test(
      spokenText,
    );

    if (isFirstPersonReply) {
      turns.push({
        id: `${chapterId}-t${i + 1}`,
        speaker: narratorCharacter.name,
        role: 'narrator',
        style: `${narratorCharacter.name} em diálogo direto, tom vivo e expressivo em português brasileiro`,
        text: spokenText,
        pauseAfterMs: 240,
      });
      continue;
    }

    const explicit = detectPersonaInText(spokenText, profile.personas);
    const chosen: KnownPersona | null = explicit ?? lastCharacterPersona ?? chapterLeadPersona;

    if (chosen) {
      lastCharacterPersona = chosen;
      if (!characterMap.has(chosen.name)) {
        characterMap.set(chosen.name, {
          name: chosen.name,
          role: 'character',
          description: chosen.description,
          defaultVoice: chosen.voice,
          defaultStyle: chosen.style,
        });
      }
      turns.push({
        id: `${chapterId}-t${i + 1}`,
        speaker: chosen.name,
        role: 'character',
        style: chosen.style,
        text: spokenText,
        pauseAfterMs: 240,
      });
    } else {
      const fallbackName = 'Interlocutor';
      if (!characterMap.has(fallbackName)) {
        characterMap.set(fallbackName, {
          name: fallbackName,
          role: 'character',
          description: 'Voz de personagem em diálogo neste capítulo.',
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
  }

  const firstReadable = raw.paragraphs.find((p) => /[a-zA-ZÀ-ÿ]{3,}/.test(p)) ?? '';
  const firstSentence =
    firstReadable.split(/(?<=[.!?])\s+/)[0]?.slice(0, 165).trim() ||
    `Capítulo ${raw.roman} de ${profile.fallbackSummaryBookTitle}.`;
  const summary =
    firstSentence.length >= 165 ? `${firstSentence.replace(/[,\s]+$/, '')}…` : firstSentence;

  const characters = Array.from(characterMap.values());

  return {
    id: chapterId,
    bookId,
    number: raw.number,
    roman: raw.roman,
    numberLabel: `Capítulo ${raw.roman}`,
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
