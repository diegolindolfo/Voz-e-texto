// server/apiApp.ts
import "dotenv/config";
import express from "express";
import fs3 from "node:fs";

// src/data/publicDomainCatalog.ts
var PUBLIC_DOMAIN_CATALOG = [
  {
    gutenbergId: 10001,
    slug: "fabulas-esopo",
    title: "F\xE1bulas de Esopo",
    author: "Esopo",
    year: 1884,
    synopsis: "Cole\xE7\xE3o com A Cigarra e a Formiga, A Lebre e a Tartaruga, O Le\xE3o e o Ratinho, A Raposa e as Uvas, O Corvo e a Raposa e O Rato do Campo.",
    narratorName: "Contador de Hist\xF3rias"
  },
  {
    gutenbergId: 10002,
    slug: "contos-grimm-perrault",
    title: "Contos Cl\xE1ssicos da Floresta",
    author: "Irm\xE3os Grimm & Charles Perrault",
    year: 1812,
    synopsis: "Chapeuzinho Vermelho, Os Tr\xEAs Porquinhos, O Gato de Botas, Jo\xE3o e o P\xE9 de Feij\xE3o e Os M\xFAsicos de Bremen com elenco completo de vozes.",
    narratorName: "Contador de Hist\xF3rias"
  },
  {
    gutenbergId: 10003,
    slug: "contos-andersen",
    title: "Contos de Hans Christian Andersen",
    author: "Hans Christian Andersen",
    year: 1843,
    synopsis: "O Patinho Feio, A Roupa Nova do Imperador, O Soldadinho de Chumbo e A Princesa e a Ervilha pr\xE9-ajustados para leitura dramatizada.",
    narratorName: "Contador de Hist\xF3rias"
  },
  {
    gutenbergId: 10004,
    slug: "fabulas-la-fontaine",
    title: "F\xE1bulas de La Fontaine",
    author: "Jean de La Fontaine",
    year: 1668,
    synopsis: "Vers\xF5es po\xE9ticas em prosa de O Lobo e o Cordeiro e A Galinha dos Ovos de Ouro, pr\xE9-ajustadas com dire\xE7\xE3o vocal e moral da hist\xF3ria.",
    narratorName: "Contador de Hist\xF3rias",
    prebuiltChapters: [
      {
        id: "lf-lobo-cordeiro",
        bookId: "fabulas-la-fontaine",
        number: 1,
        roman: "I",
        numberLabel: "F\xE1bula I",
        title: "O Lobo e o Cordeiro",
        estimatedMinutes: 2,
        wordCount: 180,
        characterCount: 3,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: "Contra quem j\xE1 decidiu agir com injusti\xE7a, os argumentos mais sinceros raramente bastam; a prud\xEAncia \xE9 a melhor defesa.",
        aiNotes: "Roteiro pr\xE9-ajustado por IA \xB7 Contraste entre a mansid\xE3o do Cordeiro (Puck) e a rispidez do Lobo (Fenrir)",
        summary: "Bebendo \xE1gua na parte baixa de um riacho cristalino, um pequeno Cordeiro responde com serenidade \xE0s acusa\xE7\xF5es sem sentido de um Lobo.",
        characters: [
          {
            name: "Contador de Hist\xF3rias",
            role: "narrator",
            description: "Narrador cl\xE1ssico de La Fontaine.",
            defaultVoice: "Charon",
            defaultStyle: "Narrador brasileiro sereno e expressivo"
          },
          {
            name: "O Lobo",
            role: "character",
            description: "R\xEDspido e \xE0 procura de um pretexto.",
            defaultVoice: "Fenrir",
            defaultStyle: "Voz grave, autorit\xE1ria e impaciente"
          },
          {
            name: "O Cordeiro",
            role: "character",
            description: "Educado, manso e sincero.",
            defaultVoice: "Puck",
            defaultStyle: "Voz jovem, suave e respeitosa"
          }
        ],
        turns: [
          {
            id: "lflc-t1",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Tom calmo descrevendo o riacho da montanha",
            text: "Um pequeno Cordeiro matava a sede nas \xE1guas limpas de um regato quando um Lobo surgiu mais acima, entre as pedras, procurando motivo para discuss\xE3o.",
            pauseAfterMs: 300
          },
          {
            id: "lflc-t2",
            speaker: "O Lobo",
            role: "character",
            style: "Voz grossa e indignada",
            text: "Como ousa sujar a \xE1gua que estou bebendo, pequeno insolente?",
            pauseAfterMs: 260
          },
          {
            id: "lflc-t3",
            speaker: "O Cordeiro",
            role: "character",
            style: "Voz mansa, educada e l\xF3gica",
            text: "Senhor Lobo, n\xE3o se zangue. Veja que estou vinte passos abaixo do senhor: a correnteza desce da sua dire\xE7\xE3o para a minha, portanto jamais poderia turvar a sua \xE1gua.",
            pauseAfterMs: 300
          },
          {
            id: "lflc-t4",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Desfecho \xE1gil e instrutivo",
            text: "Percebendo que o Lobo n\xE3o queria conversa justa, o Cordeiro deu um salto esperto para dentro do cercado do pastor, onde os c\xE3es da fazenda o protegeram em seguran\xE7a.",
            pauseAfterMs: 300
          }
        ]
      },
      {
        id: "lf-galinha-ovos-ouro",
        bookId: "fabulas-la-fontaine",
        number: 2,
        roman: "II",
        numberLabel: "F\xE1bula II",
        title: "A Galinha dos Ovos de Ouro",
        estimatedMinutes: 2,
        wordCount: 170,
        characterCount: 2,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: "A ambi\xE7\xE3o apressada perde tudo ao tentar colher de uma s\xF3 vez o que o tempo oferece dia ap\xF3s dia.",
        aiNotes: "Roteiro pr\xE9-ajustado por IA \xB7 Narra\xE7\xE3o cadenciada com di\xE1logo do Campon\xEAs (Fenrir)",
        summary: "Um campon\xEAs descobre que sua galinha p\xF5e um ovo de ouro todas as manh\xE3s, mas a pressa de enriquecer num s\xF3 dia p\xF5e tudo a perder.",
        characters: [
          {
            name: "Contador de Hist\xF3rias",
            role: "narrator",
            description: "Narrador s\xE1bio das f\xE1bulas.",
            defaultVoice: "Charon",
            defaultStyle: "Narrador pausado e reflexivo"
          },
          {
            name: "O Campon\xEAs",
            role: "character",
            description: "Homem impaciente deslumbrado pela riqueza s\xFAbita.",
            defaultVoice: "Fenrir",
            defaultStyle: "Voz primeiro maravilhada e depois impaciente"
          }
        ],
        turns: [
          {
            id: "lfgo-t1",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Tom de espanto e maravilha no s\xEDtio",
            text: "Certa manh\xE3, ao recolher os ovos no galinheiro, um campon\xEAs encontrou no ninho um ovo pesado e reluzente como o pr\xF3prio sol: era de ouro puro. E assim aconteceu todas as manh\xE3s seguintes.",
            pauseAfterMs: 320
          },
          {
            id: "lfgo-t2",
            speaker: "O Campon\xEAs",
            role: "character",
            style: "Tom apressado e ambicioso",
            text: "Por que esperar um \xFAnico ovo por dia? Deve haver um tesouro inteiro escondido l\xE1 dentro! Quero todas as moedas hoje mesmo!",
            pauseAfterMs: 280
          },
          {
            id: "lfgo-t3",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Tom sereno de li\xE7\xE3o moral",
            text: "Ao desfazer o ninho m\xE1gico em sua pressa, o campon\xEAs descobriu que n\xE3o havia mina alguma escondida, e aprendeu que a verdadeira prosperidade exige paci\xEAncia e gratid\xE3o.",
            pauseAfterMs: 300
          }
        ]
      }
    ]
  },
  {
    gutenbergId: 10005,
    slug: "contos-carochinha",
    title: "Contos Populares da Carochinha",
    author: "Tradi\xE7\xE3o Oral Luso-Brasileira",
    year: 1894,
    synopsis: "A Festa no C\xE9u e A Dona Baratinha recontadas com vozes divertidas, ritmo musical e expressividade para crian\xE7as.",
    narratorName: "Contador de Hist\xF3rias",
    prebuiltChapters: [
      {
        id: "cc-festa-no-ceu",
        bookId: "contos-carochinha",
        number: 1,
        roman: "I",
        numberLabel: "Conto I",
        title: "A Festa no C\xE9u",
        estimatedMinutes: 2,
        wordCount: 195,
        characterCount: 3,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: "A esperteza pode levar longe, mas \xE9 bom lembrar do caminho de volta antes de saltar nas nuvens.",
        aiNotes: "Roteiro pr\xE9-ajustado por IA \xB7 Folclore brasileiro com o Jabuti (Puck) e o Urubu Violeiro (Fenrir)",
        summary: "Todas as aves foram convidadas para um grande baile nas nuvens \u2014 e o Jabuti, mesmo sem asas, resolveu dar um jeito de comparecer escondido na viola.",
        characters: [
          {
            name: "Contador de Hist\xF3rias",
            role: "narrator",
            description: "Contador de causos e contos populares brasileiros.",
            defaultVoice: "Charon",
            defaultStyle: "Narrador brasileiro caloroso, musical e divertido"
          },
          {
            name: "O Jabuti",
            role: "character",
            description: "Astuto, festeiro e cheio de conversa.",
            defaultVoice: "Puck",
            defaultStyle: "Voz alegre, travessa e confiante"
          },
          {
            name: "O Urubu Violeiro",
            role: "character",
            description: "M\xFAsico das alturas que leva sua viola para a festa.",
            defaultVoice: "Fenrir",
            defaultStyle: "Voz grave, serena e surpresa com o peso da viola"
          }
        ],
        turns: [
          {
            id: "ccfc-t1",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Tom festivo de conto popular brasileiro",
            text: "Espalhou-se pela floresta a not\xEDcia de que haveria uma grande festa no c\xE9u, mas s\xF3 quem tivesse asas poderia voar at\xE9 as nuvens. O Jabuti, que adorava m\xFAsica, escondeu-se bem quietinho dentro da viola do compadre Urubu.",
            pauseAfterMs: 320
          },
          {
            id: "ccfc-t2",
            speaker: "O Urubu Violeiro",
            role: "character",
            style: "Estranhando o peso enquanto bate as asas",
            text: "Puxa vida, minha viola hoje parece mais pesada do que de costume! Deve ser a umidade da manh\xE3 na beira do rio.",
            pauseAfterMs: 280
          },
          {
            id: "ccfc-t3",
            speaker: "O Jabuti",
            role: "character",
            style: "Saindo da viola no meio das nuvens com alegria",
            text: "Boa noite, passarada! Quem disse que jabuti n\xE3o sabe dan\xE7ar ciranda nas nuvens?",
            pauseAfterMs: 300
          },
          {
            id: "ccfc-t4",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Desfecho divertido explicando os remendos do casco do jabuti",
            text: "Depois de dan\xE7ar a noite inteira, o Jabuti voltou na viola, caiu num tapete de folhas macias e remendou seu casco pe\xE7a por pe\xE7a \u2014 e \xE9 por isso que, at\xE9 hoje, todo jabuti tem o casco cheio de desenhinhos.",
            pauseAfterMs: 300
          }
        ]
      }
    ]
  }
];

// src/lib/gutenbergParser.ts
var ROMAN_RE = /^(M{0,3})(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})\.?$/;
var CAP_ROMAN_RE = /^(?:CAP[IÍ]T?ULO|CAP\.?|PARTE)\s+([IVXLCDM]+)(?:\s*[-—–:.]\s*(.+))?\.?$/i;
var CAP_ARABIC_RE = /^(?:CAP[IÍ]T?ULO|CAP\.?|PARTE)\s+(\d{1,3})(?:\s*[-—–:.]\s*(.+))?\.?$/i;
var MARKDOWN_HEADING_RE = /^#{1,3}\s+(.+)$/;
function intToRoman(num) {
  if (!Number.isFinite(num) || num <= 0) return String(num);
  const table = [
    [1e3, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"]
  ];
  let remaining = Math.floor(num);
  let out = "";
  for (const [value, symbol] of table) {
    while (remaining >= value) {
      out += symbol;
      remaining -= value;
    }
  }
  return out;
}
function romanToInt(roman) {
  const clean = roman.trim().replace(/\.$/, "").toUpperCase();
  if (!clean || !ROMAN_RE.test(clean)) return 0;
  const map = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1e3
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
function cleanLineText(text) {
  return text.replace(/_([^_]+)_/g, "$1").replace(/^--\s*/, "\u2014 ").replace(/\s+--\s*/g, " \u2014 ").replace(/--/g, " \u2014 ").replace(/\s+/g, " ").trim();
}
function cleanChapterTitle(title) {
  const cleaned = cleanLineText(title);
  return cleaned.endsWith(".") && !cleaned.endsWith("...") ? cleaned.slice(0, -1).trim() : cleaned;
}
function extractGutenbergMetadata(rawText) {
  const header = rawText.slice(0, 3500).replace(/\r\n/g, "\n");
  const titleMatch = header.match(/^Title:\s*(.+)$/im);
  const authorMatch = header.match(/^Author:\s*(.+)$/im);
  const langMatch = header.match(/^Language:\s*(.+)$/im);
  return {
    title: titleMatch?.[1]?.trim(),
    author: authorMatch?.[1]?.trim(),
    language: langMatch?.[1]?.trim()
  };
}
function stripGutenbergBoilerplate(rawText) {
  const normalized = rawText.replace(/\r\n/g, "\n");
  const startMarker = "*** START OF THE PROJECT GUTENBERG EBOOK";
  const endMarker = "*** END OF THE PROJECT GUTENBERG EBOOK";
  const startIdx = normalized.indexOf(startMarker);
  const bodyStart = startIdx >= 0 ? normalized.indexOf("\n", startIdx) + 1 : 0;
  const endIdx = normalized.indexOf(endMarker);
  const rawBody = endIdx >= 0 ? normalized.slice(bodyStart, endIdx) : normalized.slice(bodyStart);
  const lines = rawBody.split("\n");
  let stopLine = lines.length;
  const minFimLine = Math.floor(lines.length * 0.6);
  for (let i = lines.length - 1; i >= minFimLine; i--) {
    const trimmed = lines[i].trim().toUpperCase();
    if (trimmed === "FIM" || trimmed === "FIM.") {
      stopLine = i;
      break;
    }
  }
  return lines.slice(0, stopLine);
}
function parseParagraphsFromLines(contentLines) {
  const paragraphs = [];
  let buffer = [];
  const flush = () => {
    if (buffer.length > 0) {
      const joined = cleanLineText(buffer.join(" "));
      if (joined.length > 0) {
        paragraphs.push(joined);
      }
      buffer = [];
    }
  };
  for (const line of contentLines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      flush();
    } else if (trimmed.startsWith("--") || trimmed.startsWith("\u2014")) {
      flush();
      buffer.push(trimmed);
    } else {
      buffer.push(trimmed);
    }
  }
  flush();
  return paragraphs;
}
function isLikelySubtitleLine(blockLines) {
  if (blockLines.length === 0 || blockLines.length > 2) return false;
  const joined = cleanLineText(blockLines.join(" "));
  if (!joined || joined.length > 96) return false;
  if (joined.startsWith("\u2014") || joined.startsWith("--")) return false;
  if (/[,;:]$/.test(joined)) return false;
  const sentenceBreaks = joined.match(/[.!?]\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/g);
  if (sentenceBreaks && sentenceBreaks.length >= 2) return false;
  return true;
}
function parsePublicDomainBookText(rawText) {
  const bookLines = stripGutenbergBoilerplate(rawText);
  const candidates = [];
  for (let i = 0; i < bookLines.length; i++) {
    const trimmed = bookLines[i].trim();
    if (!trimmed || trimmed.length > 110) continue;
    const prevBlank = i === 0 || bookLines[i - 1].trim() === "";
    const nextBlank = i === bookLines.length - 1 || bookLines[i + 1].trim() === "";
    const capRoman = trimmed.match(CAP_ROMAN_RE);
    if (capRoman && prevBlank && nextBlank) {
      const num = romanToInt(capRoman[1]);
      if (num > 0) {
        candidates.push({
          lineIndex: i,
          number: num,
          roman: capRoman[1].toUpperCase(),
          inlineTitle: capRoman[2]?.trim(),
          kind: "cap-roman"
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
          kind: "cap-arabic"
        });
        continue;
      }
    }
    if (trimmed.length <= 12 && ROMAN_RE.test(trimmed) && prevBlank && nextBlank) {
      const num = romanToInt(trimmed);
      if (num > 0) {
        candidates.push({
          lineIndex: i,
          number: num,
          roman: trimmed.replace(/\.$/, "").toUpperCase(),
          kind: "bare-roman"
        });
        continue;
      }
    }
    const mdMatch = trimmed.match(MARKDOWN_HEADING_RE);
    if (mdMatch && prevBlank) {
      candidates.push({
        lineIndex: i,
        number: candidates.length + 1,
        roman: intToRoman(candidates.length + 1),
        inlineTitle: mdMatch[1].trim(),
        kind: "markdown"
      });
    }
  }
  const isSubstantive = (idx, nextLine) => {
    let nonEmptyLines = 0;
    for (let l = idx + 1; l < nextLine; l++) {
      if (bookLines[l].trim().length > 0) {
        nonEmptyLines++;
        if (nonEmptyLines >= 1) return true;
      }
    }
    return false;
  };
  const numberedCandidates = candidates.filter((c) => c.kind !== "markdown");
  let bestChain = [];
  for (let start = 0; start < numberedCandidates.length; start++) {
    if (numberedCandidates[start].number !== 1) continue;
    const chain = [];
    let expected = 1;
    for (let k = start; k < numberedCandidates.length; k++) {
      const cand = numberedCandidates[k];
      if (cand.number !== expected) continue;
      const nextCandLine = k + 1 < numberedCandidates.length ? numberedCandidates[k + 1].lineIndex : bookLines.length;
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
  let selectedMarkers = bestChain;
  if (selectedMarkers.length < 2) {
    const mdCandidates = candidates.filter((c) => c.kind === "markdown");
    if (mdCandidates.length >= 1) {
      selectedMarkers = mdCandidates.map((c, idx) => ({
        ...c,
        number: idx + 1,
        roman: intToRoman(idx + 1)
      }));
    }
  }
  if (selectedMarkers.length === 0) {
    const allParagraphs = parseParagraphsFromLines(bookLines);
    if (allParagraphs.length === 0) return [];
    const totalWords = allParagraphs.reduce(
      (acc, p) => acc + p.split(/\s+/).filter(Boolean).length,
      0
    );
    if (totalWords <= 1800) {
      return [
        {
          number: 1,
          roman: "I",
          title: "Texto integral",
          paragraphs: allParagraphs,
          wordCount: totalWords
        }
      ];
    }
    const sections = [];
    let currentParas = [];
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
          wordCount: currentWords
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
        wordCount: currentWords
      });
    }
    return sections;
  }
  const chapters = [];
  for (let idx = 0; idx < selectedMarkers.length; idx++) {
    const current = selectedMarkers[idx];
    const nextHeadingLine = idx + 1 < selectedMarkers.length ? selectedMarkers[idx + 1].lineIndex : bookLines.length;
    let bodyStartLine = current.lineIndex + 1;
    let title = current.inlineTitle ? cleanChapterTitle(current.inlineTitle) : "";
    if (!title) {
      let j = bodyStartLine;
      while (j < nextHeadingLine && bookLines[j].trim() === "") {
        j++;
      }
      const firstBlock = [];
      let blockEnd = j;
      while (blockEnd < nextHeadingLine && bookLines[blockEnd].trim() !== "") {
        firstBlock.push(bookLines[blockEnd].trim());
        blockEnd++;
      }
      let hasMoreContent = false;
      for (let k = blockEnd; k < nextHeadingLine; k++) {
        if (bookLines[k].trim() !== "") {
          hasMoreContent = true;
          break;
        }
      }
      if (hasMoreContent && isLikelySubtitleLine(firstBlock)) {
        title = cleanChapterTitle(firstBlock.join(" "));
        bodyStartLine = blockEnd;
      } else {
        title = `Cap\xEDtulo ${current.roman}`;
      }
    }
    const contentLines = bookLines.slice(bodyStartLine, nextHeadingLine);
    let paragraphs = parseParagraphsFromLines(contentLines);
    if (paragraphs.length === 0) {
      paragraphs = ["..."];
    }
    const wordCount = paragraphs.reduce(
      (acc, p) => acc + p.split(/\s+/).filter(Boolean).length,
      0
    );
    chapters.push({
      number: current.number,
      roman: current.roman,
      title: title || `Cap\xEDtulo ${current.roman}`,
      paragraphs,
      wordCount
    });
  }
  return chapters;
}
var DOM_CASMURRO_PERSONAS = [
  {
    name: "Capitu",
    patterns: [/\bcapit[uú]\b/i],
    voice: "Zephyr",
    description: "Vizinha e grande amor de Bentinho, perspicaz e expressiva.",
    style: "Voz feminina jovem e vivaz em portugu\xEAs brasileiro, olhar atento e firmeza serena"
  },
  {
    name: "Jos\xE9 Dias",
    patterns: [/\bjos[ée]\s+dias\b/i, /\baggregado\b/i, /\bagregado\b/i],
    voice: "Fenrir",
    description: "Agregado da fam\xEDlia, solene, diplom\xE1tico e amante de superlativos.",
    style: "Homem brasileiro formal e solene, voz grave e enf\xE1tica com pausas teatrais"
  },
  {
    name: "Dona Gl\xF3ria",
    patterns: [/\bd\.\s*gl[óo]ria\b/i, /\bdona\s+gl[óo]ria\b/i, /\bmamãe\b/i, /\bminha\s+mãe\b/i],
    voice: "Kore",
    description: "M\xE3e de Bentinho, piedosa, carinhosa e fiel \xE0 promessa do semin\xE1rio.",
    style: "Senhora brasileira terna e serena, voz acolhedora e delicada"
  },
  {
    name: "Escobar",
    patterns: [/\bescobar\b/i, /\bezequiel\s+de\s+sousa\b/i],
    voice: "Puck",
    description: "Amigo \xEDntimo do semin\xE1rio, articulado, inteligente e cort\xEAs.",
    style: "Homem brasileiro jovem e articulado, tom cordial e persuasivo"
  },
  {
    name: "Tio Cosme",
    patterns: [/\btio\s+cosme\b/i, /\bcosme\b/i],
    voice: "Fenrir",
    description: "Tio advogado, bonach\xE3o, ir\xF4nico e bem-humorado.",
    style: "Voz masculina madura e bem-humorada, tom descontra\xEDdo e sonoro"
  },
  {
    name: "Prima Justina",
    patterns: [/\bprima\s+justina\b/i, /\bjustina\b/i],
    voice: "Kore",
    description: "Parenta franca, observadora e de coment\xE1rios secos.",
    style: "Voz feminina madura, franca e levemente seca"
  },
  {
    name: "P\xE1dua",
    patterns: [/\bp[áa]dua\b/i, /\btartaruga\b/i],
    voice: "Fenrir",
    description: "Pai de Capitu, emotivo, modesto e falante.",
    style: "Voz masculina calorosa e expansiva, tom humilde e emotivo"
  },
  {
    name: "Sancha",
    patterns: [/\bsancha\b/i],
    voice: "Kore",
    description: "Amiga de Capitu e esposa de Escobar, gentil e reservada.",
    style: "Voz feminina suave, educada e serena"
  },
  {
    name: "Ezequiel",
    patterns: [/\bezequiel\b/i],
    voice: "Puck",
    description: "Filho de Bento e Capitu, curioso e en\xE9rgico.",
    style: "Voz jovem, curiosa e espont\xE2nea"
  }
];
var BRAS_CUBAS_PERSONAS = [
  {
    name: "Virg\xEDlia",
    patterns: [/\bvirg[íi]lia\b/i],
    voice: "Zephyr",
    description: "Grande paix\xE3o de Br\xE1s Cubas, elegante, apaixonada e ambiciosa.",
    style: "Voz feminina brasileira elegante, envolvente e levemente maliciosa"
  },
  {
    name: "Quincas Borba",
    patterns: [/\bquincas\s+borba\b/i, /\bhumanitismo\b/i],
    voice: "Fenrir",
    description: "Fil\xF3sofo exc\xEAntrico e criador do Humanitismo, enf\xE1tico e grandiloquente.",
    style: "Homem brasileiro teatral e filos\xF3fico, voz grave, vibrante e expansiva"
  },
  {
    name: "Marcela",
    patterns: [/\bmarcel+a\b/i],
    voice: "Kore",
    description: "Cortes\xE3 espanhola da juventude de Br\xE1s Cubas, sedutora e pr\xE1tica.",
    style: "Voz feminina calorosa, sedutora e segura"
  },
  {
    name: "Lobo Neves",
    patterns: [/\blobo\s+neves\b/i],
    voice: "Fenrir",
    description: "Marido de Virg\xEDlia e pol\xEDtico ambicioso, grave e supersticioso.",
    style: "Homem brasileiro formal e pol\xEDtico, voz firme e comedida"
  },
  {
    name: "Dona Pl\xE1cida",
    patterns: [/\bd\.\s*pl[áa]cida\b/i, /\bdona\s+pl[áa]cida\b/i, /\bpl[áa]cida\b/i],
    voice: "Kore",
    description: "Confidente humilde e dedicada da casinha da Gamboa.",
    style: "Senhora brasileira humilde, voz mansa, respeitosa e melanc\xF3lica"
  },
  {
    name: "Eug\xEAnia",
    patterns: [/\beug[êe]nia\b/i],
    voice: "Zephyr",
    description: "A flor da moita na Tijuca, franca, altiva e melanc\xF3lica.",
    style: "Jovem brasileira sincera e serena, voz l\xEDmpida e firme"
  },
  {
    name: "Cotrim",
    patterns: [/\bcotrim\b/i],
    voice: "Fenrir",
    description: "Cunhado de Br\xE1s Cubas, seco, met\xF3dico e calculista.",
    style: "Homem brasileiro seco e pragm\xE1tico, voz direta e contida"
  },
  {
    name: "Sabina",
    patterns: [/\bsabina\b/i],
    voice: "Kore",
    description: "Irm\xE3 de Br\xE1s Cubas, afetuosa, falante e casamenteira.",
    style: "Voz feminina expressiva, viva e familiar"
  },
  {
    name: "Prud\xEAncio",
    patterns: [/\bprud[êe]ncio\b/i],
    voice: "Puck",
    description: "Ex-escravizado da casa dos Cubas.",
    style: "Voz masculina direta e expressiva em portugu\xEAs brasileiro"
  }
];
function getBookPersonaProfile(bookId, options) {
  if (bookId === "dom-casmurro") {
    return {
      chapterIdPrefix: "dc-cap",
      narrator: {
        name: "Bentinho (Narrador)",
        role: "narrator",
        description: "Voz madura, ir\xF4nica e contemplativa de Bento Santiago.",
        defaultVoice: "Charon",
        defaultStyle: "Narrador brasileiro culto e maduro, tom intimista, cad\xEAncia calma e ironia sutil de Machado de Assis"
      },
      personas: DOM_CASMURRO_PERSONAS,
      fallbackSummaryBookTitle: "Dom Casmurro"
    };
  }
  if (bookId === "bras-cubas") {
    return {
      chapterIdPrefix: "bc-cap",
      narrator: {
        name: "Br\xE1s Cubas (Narrador)",
        role: "narrator",
        description: "Defunto autor, espirituoso, mordaz e elegante.",
        defaultVoice: "Charon",
        defaultStyle: "Narrador brasileiro espirituoso, ir\xF4nico e mordaz, conversando diretamente com o leitor com flu\xEAncia elegante"
      },
      personas: BRAS_CUBAS_PERSONAS,
      fallbackSummaryBookTitle: "Mem\xF3rias P\xF3stumas de Br\xE1s Cubas"
    };
  }
  const cleanPrefix = bookId.replace(/[^a-z0-9-]/gi, "").slice(0, 24) || "livro";
  return {
    chapterIdPrefix: `${cleanPrefix}-cap`,
    narrator: {
      name: options?.narratorName?.trim() || "Narrador",
      role: "narrator",
      description: "Voz principal da narrativa liter\xE1ria em portugu\xEAs brasileiro.",
      defaultVoice: "Charon",
      defaultStyle: "Narrador liter\xE1rio brasileiro, voz natural, cad\xEAncia envolvente e dic\xE7\xE3o clara"
    },
    personas: [],
    fallbackSummaryBookTitle: options?.bookTitle || "esta obra"
  };
}
function detectPersonaInText(text, personas) {
  for (const persona of personas) {
    if (persona.patterns.some((re) => re.test(text))) {
      return persona;
    }
  }
  return null;
}
function buildChapterFromRaw(raw, bookId = "dom-casmurro", options) {
  const profile = getBookPersonaProfile(bookId, options);
  const chapterId = `${profile.chapterIdPrefix}-${raw.number}`;
  const narratorCharacter = profile.narrator;
  const characterMap = /* @__PURE__ */ new Map();
  characterMap.set(narratorCharacter.name, narratorCharacter);
  const turns = [];
  let lastCharacterPersona = null;
  let hasDialogue = false;
  const chapterText = raw.paragraphs.join(" ");
  const chapterLeadPersona = detectPersonaInText(chapterText, profile.personas);
  for (let i = 0; i < raw.paragraphs.length; i++) {
    const paragraph = raw.paragraphs[i];
    const isDialogue = paragraph.startsWith("\u2014");
    if (!isDialogue) {
      const mentioned = detectPersonaInText(paragraph, profile.personas);
      if (mentioned) {
        lastCharacterPersona = mentioned;
      }
      turns.push({
        id: `${chapterId}-t${i + 1}`,
        speaker: narratorCharacter.name,
        role: "narrator",
        style: narratorCharacter.defaultStyle,
        text: paragraph,
        pauseAfterMs: 320
      });
      continue;
    }
    hasDialogue = true;
    const spokenText = paragraph.replace(/^—\s*/, "").trim();
    const isFirstPersonReply = /\b(disse\s+eu|respondi|perguntei|retorqui|acudi|repliquei|murmurei)\b/i.test(
      spokenText
    );
    if (isFirstPersonReply) {
      turns.push({
        id: `${chapterId}-t${i + 1}`,
        speaker: narratorCharacter.name,
        role: "narrator",
        style: `${narratorCharacter.name} em di\xE1logo direto, tom vivo e expressivo em portugu\xEAs brasileiro`,
        text: spokenText,
        pauseAfterMs: 240
      });
      continue;
    }
    const explicit = detectPersonaInText(spokenText, profile.personas);
    const chosen = explicit ?? lastCharacterPersona ?? chapterLeadPersona;
    if (chosen) {
      lastCharacterPersona = chosen;
      if (!characterMap.has(chosen.name)) {
        characterMap.set(chosen.name, {
          name: chosen.name,
          role: "character",
          description: chosen.description,
          defaultVoice: chosen.voice,
          defaultStyle: chosen.style
        });
      }
      turns.push({
        id: `${chapterId}-t${i + 1}`,
        speaker: chosen.name,
        role: "character",
        style: chosen.style,
        text: spokenText,
        pauseAfterMs: 240
      });
    } else {
      const fallbackName = "Interlocutor";
      if (!characterMap.has(fallbackName)) {
        characterMap.set(fallbackName, {
          name: fallbackName,
          role: "character",
          description: "Voz de personagem em di\xE1logo neste cap\xEDtulo.",
          defaultVoice: "Puck",
          defaultStyle: "Personagem brasileiro em di\xE1logo natural e expressivo"
        });
      }
      turns.push({
        id: `${chapterId}-t${i + 1}`,
        speaker: fallbackName,
        role: "character",
        style: "Personagem brasileiro em di\xE1logo natural e expressivo",
        text: spokenText,
        pauseAfterMs: 240
      });
    }
  }
  const firstReadable = raw.paragraphs.find((p) => /[a-zA-ZÀ-ÿ]{3,}/.test(p)) ?? "";
  const firstSentence = firstReadable.split(/(?<=[.!?])\s+/)[0]?.slice(0, 165).trim() || `Cap\xEDtulo ${raw.roman} de ${profile.fallbackSummaryBookTitle}.`;
  const summary = firstSentence.length >= 165 ? `${firstSentence.replace(/[,\s]+$/, "")}\u2026` : firstSentence;
  const characters = Array.from(characterMap.values());
  return {
    id: chapterId,
    bookId,
    number: raw.number,
    roman: raw.roman,
    numberLabel: `Cap\xEDtulo ${raw.roman}`,
    title: raw.title,
    estimatedMinutes: Math.max(1, Math.round(raw.wordCount / 140)),
    wordCount: raw.wordCount,
    characterCount: characters.length,
    hasDialogue,
    dramatizedByAi: false,
    summary,
    characters,
    turns
  };
}
function slugifyBookId(title) {
  const base = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 42);
  return base || `livro-${Date.now()}`;
}

// src/lib/rateLimit.ts
function parseRetryDelayMs(errorText) {
  if (!errorText) return null;
  const jsonMatch = errorText.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i);
  if (jsonMatch) {
    const sec = Number.parseFloat(jsonMatch[1]);
    if (Number.isFinite(sec) && sec > 0) {
      return clampDelayMs(Math.ceil(sec * 1e3) + 600);
    }
  }
  const textMatch = errorText.match(/retry\s+in\s+(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)/i);
  if (textMatch) {
    const sec = Number.parseFloat(textMatch[1]);
    if (Number.isFinite(sec) && sec > 0) {
      return clampDelayMs(Math.ceil(sec * 1e3) + 600);
    }
  }
  return null;
}
function clampDelayMs(ms) {
  return Math.max(1500, Math.min(65e3, Math.round(ms)));
}
function isDailyQuotaError(errorText) {
  if (!errorText) return false;
  return /GenerateRequestsPerDay|PerDay|requests_per_day|per\s+day|daily\s+quota|quota\s+exceeded.*day/i.test(
    errorText
  );
}
function isRateLimitError(errorText) {
  if (!errorText) return false;
  return /\b429\b|RESOURCE_EXHAUSTED|rate\s*limit|too\s+many\s+requests|quota/i.test(errorText);
}
function isRetryableGeminiError(errorText) {
  if (!errorText) return false;
  if (isDailyQuotaError(errorText)) return false;
  return isRateLimitError(errorText) || /\b(500|502|503|504)\b|UNAVAILABLE|DEADLINE_EXCEEDED|ECONNRESET|ETIMEDOUT/i.test(errorText);
}
function computeBackoffDelayMs(params) {
  const parsed = parseRetryDelayMs(params.errorText);
  if (parsed !== null) {
    return parsed;
  }
  const baseSchedule = [4e3, 9e3, 18e3, 3e4, 45e3];
  const scheduled = baseSchedule[Math.min(Math.max(0, params.attempt - 1), baseSchedule.length - 1)];
  const floor = params.adaptivePacingMs ?? 0;
  return clampDelayMs(Math.max(scheduled, floor));
}
var AdaptivePacer = class {
  constructor(baseSpacingMs = 1500) {
    this.lastCallCompletedAt = 0;
    this.consecutiveSuccesses = 0;
    this.baseSpacingMs = Math.max(400, baseSpacingMs);
    this.currentSpacingMs = this.baseSpacingMs;
  }
  getSpacingMs() {
    return this.currentSpacingMs;
  }
  setBaseSpacingMs(ms) {
    this.baseSpacingMs = Math.max(400, Math.min(3e4, Math.round(ms)));
    this.currentSpacingMs = Math.max(this.baseSpacingMs, this.currentSpacingMs);
  }
  getRequiredWaitMs(now = Date.now(), minOverrideMs = 0) {
    if (this.lastCallCompletedAt === 0) return 0;
    const spacing = Math.max(this.currentSpacingMs, minOverrideMs);
    const elapsed = now - this.lastCallCompletedAt;
    return Math.max(0, spacing - elapsed);
  }
  recordSuccess(now = Date.now()) {
    this.lastCallCompletedAt = now;
    this.consecutiveSuccesses += 1;
    if (this.consecutiveSuccesses >= 3 && this.currentSpacingMs > this.baseSpacingMs) {
      this.currentSpacingMs = Math.max(this.baseSpacingMs, Math.round(this.currentSpacingMs * 0.75));
      this.consecutiveSuccesses = 0;
    }
  }
  recordRateLimit(retryDelayMs, now = Date.now()) {
    this.lastCallCompletedAt = now;
    this.consecutiveSuccesses = 0;
    const bumped = Math.max(this.currentSpacingMs * 1.8, retryDelayMs ?? 8e3);
    this.currentSpacingMs = Math.min(25e3, Math.round(bumped));
  }
};

// src/lib/scriptParser.ts
function computeDeterministicHash(input) {
  let h1 = 2166136261;
  let h2 = 2654435761;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 16777619);
    h2 ^= ch + (i + 1 & 255);
    h2 = Math.imul(h2, 2246822507);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const part2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `${part1}${part2}`;
}
function computeChapterCacheKey(input) {
  const safeChapter = input.chapterId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "cap";
  const sortedVoices = Object.keys(input.voiceMap).sort().map((speaker) => `${speaker}:${input.voiceMap[speaker]}`).join("|");
  const normalizedTurns = input.turns.map(
    (turn) => [
      turn.speaker.trim(),
      turn.style.trim(),
      turn.text.replace(/\s+/g, " ").trim(),
      String(turn.pauseAfterMs ?? 280)
    ].join("::")
  ).join("\n");
  const payload = `v1|${safeChapter}|${input.mode}|${sortedVoices}|${normalizedTurns}`;
  const hash = computeDeterministicHash(payload);
  return `${safeChapter}-${input.mode === "dramatized" ? "mv" : "solo"}-${hash}`;
}
function resolveVoiceForTurn(turn, voiceMap, mode, primaryNarratorVoice) {
  if (mode === "narrator") {
    return primaryNarratorVoice;
  }
  return voiceMap[turn.speaker] ?? primaryNarratorVoice;
}
function computeBatchFingerprint(batch) {
  const canonical = JSON.stringify({
    speakers: batch.speakers.map((s) => `${s.label}:${s.voiceName}`),
    turns: batch.turns.map((t) => ({
      s: t.speakerLabel,
      v: t.voiceName,
      st: t.turn.style.trim(),
      tx: t.turn.text.trim()
    }))
  });
  let h1 = 3735928559 ^ canonical.length;
  let h2 = 1103547991 ^ canonical.length;
  for (let i = 0; i < canonical.length; i++) {
    const ch = canonical.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0).toString(16).padStart(8, "0")}`;
}
function batchTurnsForTts(turns, voiceMap, mode, primaryNarratorVoice, maxCharsPerBatch = 3400) {
  const batches = [];
  for (const turn of turns) {
    const voiceName = resolveVoiceForTurn(turn, voiceMap, mode, primaryNarratorVoice);
    const speakerLabel = mode === "narrator" ? "Narrador" : turn.speaker;
    const current = batches[batches.length - 1];
    if (current) {
      const existingSpeaker = current.speakers.find((s) => s.label === speakerLabel);
      const existingVoiceConflict = current.speakers.find(
        (s) => s.voiceName === voiceName && s.label !== speakerLabel
      );
      const currentChars = current.turns.reduce((sum, item) => sum + item.turn.text.length, 0);
      const fitsChars = currentChars + turn.text.length <= maxCharsPerBatch;
      if (fitsChars && !existingVoiceConflict && (existingSpeaker || current.speakers.length < 2)) {
        if (!existingSpeaker) {
          current.speakers.push({ label: speakerLabel, voiceName });
        }
        current.turns.push({ turn, speakerLabel, voiceName });
        current.pauseAfterMs = turn.pauseAfterMs ?? 300;
        continue;
      }
    }
    batches.push({
      id: `batch-${batches.length + 1}`,
      speakers: [{ label: speakerLabel, voiceName }],
      turns: [{ turn, speakerLabel, voiceName }],
      pauseAfterMs: turn.pauseAfterMs ?? 300
    });
  }
  return batches;
}
function expandBatchTimingsToTurns(batches, batchTimings) {
  const segments = [];
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const timing = batchTimings[i];
    if (!timing) continue;
    const span = Math.max(0, timing.endSec - timing.startSec);
    const weights = batch.turns.map((item) => Math.max(1, item.turn.text.length));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let cursor = timing.startSec;
    for (let j = 0; j < batch.turns.length; j++) {
      const item = batch.turns[j];
      const share = j === batch.turns.length - 1 ? timing.endSec - cursor : span * weights[j] / totalWeight;
      const endSec = j === batch.turns.length - 1 ? timing.endSec : cursor + share;
      segments.push({
        turnId: item.turn.id,
        speaker: item.turn.speaker,
        voiceName: item.voiceName,
        startSec: Number(cursor.toFixed(3)),
        endSec: Number(endSec.toFixed(3))
      });
      cursor = endSec;
    }
  }
  return segments;
}

// server/audioCache.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// src/data/prerenderedAudioCatalog.ts
var STATIC_PRERENDERED_AUDIOS = {
  "esopo-cigarra-formiga-mv-aae4b20ec72aa6d1": {
    chapterId: "esopo-cigarra-formiga",
    bookTitle: "F\xE1bulas de Esopo",
    chapterTitle: "A Cigarra e a Formiga",
    mode: "dramatized",
    voiceMap: {
      "Contador de Hist\xF3rias": "Charon",
      "A Cigarra": "Zephyr",
      "A Formiga": "Kore"
    },
    durationSec: 87.62,
    segments: [
      {
        turnId: "ecf-t1",
        speaker: "Contador de Hist\xF3rias",
        voiceName: "Charon",
        startSec: 0,
        endSec: 23.55
      },
      {
        turnId: "ecf-t2",
        speaker: "A Cigarra",
        voiceName: "Zephyr",
        startSec: 23.55,
        endSec: 35.56
      },
      {
        turnId: "ecf-t3",
        speaker: "A Formiga",
        voiceName: "Kore",
        startSec: 35.84,
        endSec: 47.082
      },
      {
        turnId: "ecf-t4",
        speaker: "Contador de Hist\xF3rias",
        voiceName: "Charon",
        startSec: 47.082,
        endSec: 59.6
      },
      {
        turnId: "ecf-t5",
        speaker: "A Cigarra",
        voiceName: "Zephyr",
        startSec: 59.9,
        endSec: 68.456
      },
      {
        turnId: "ecf-t6",
        speaker: "A Formiga",
        voiceName: "Kore",
        startSec: 68.456,
        endSec: 87.62
      }
    ],
    cacheKey: "esopo-cigarra-formiga-mv-aae4b20ec72aa6d1",
    fileSizeBytes: 4205804,
    createdAt: "2026-11-20T00:57:26.312Z",
    audioUrl: "/audio-cache/esopo-cigarra-formiga-mv-aae4b20ec72aa6d1.wav"
  },
  "esopo-lebre-tartaruga-mv-7ed0fb234bc28609": {
    chapterId: "esopo-lebre-tartaruga",
    bookTitle: "F\xE1bulas de Esopo",
    chapterTitle: "A Lebre e a Tartaruga",
    mode: "dramatized",
    voiceMap: {
      "Contador de Hist\xF3rias": "Charon",
      "A Lebre": "Puck",
      "A Tartaruga": "Kore"
    },
    durationSec: 58.32,
    segments: [
      {
        turnId: "elt-t1",
        speaker: "Contador de Hist\xF3rias",
        voiceName: "Charon",
        startSec: 0,
        endSec: 11.323
      },
      {
        turnId: "elt-t2",
        speaker: "A Lebre",
        voiceName: "Puck",
        startSec: 11.323,
        endSec: 18.4
      },
      {
        turnId: "elt-t3",
        speaker: "A Tartaruga",
        voiceName: "Kore",
        startSec: 18.66,
        endSec: 26.991
      },
      {
        turnId: "elt-t4",
        speaker: "Contador de Hist\xF3rias",
        voiceName: "Charon",
        startSec: 26.991,
        endSec: 46.5
      },
      {
        turnId: "elt-t5",
        speaker: "A Lebre",
        voiceName: "Puck",
        startSec: 46.86,
        endSec: 52.025
      },
      {
        turnId: "elt-t6",
        speaker: "A Tartaruga",
        voiceName: "Kore",
        startSec: 52.025,
        endSec: 58.32
      }
    ],
    cacheKey: "esopo-lebre-tartaruga-mv-7ed0fb234bc28609",
    fileSizeBytes: 2799404,
    createdAt: "2026-11-20T00:59:13.177Z",
    audioUrl: "/audio-cache/esopo-lebre-tartaruga-mv-7ed0fb234bc28609.wav"
  },
  "andersen-patinho-feio-mv-bebf3a19a6217735": {
    chapterId: "andersen-patinho-feio",
    bookTitle: "Contos de Hans Christian Andersen",
    chapterTitle: "O Patinho Feio",
    mode: "dramatized",
    voiceMap: {
      "Contador de Hist\xF3rias": "Charon",
      "M\xE3e Pata": "Kore",
      "O Jovem Patinho": "Puck",
      "O Cisne Real": "Zephyr"
    },
    durationSec: 62.28,
    segments: [
      {
        turnId: "apf-t1",
        speaker: "Contador de Hist\xF3rias",
        voiceName: "Charon",
        startSec: 0,
        endSec: 15.006
      },
      {
        turnId: "apf-t2",
        speaker: "M\xE3e Pata",
        voiceName: "Kore",
        startSec: 15.006,
        endSec: 24.413
      },
      {
        turnId: "apf-t3",
        speaker: "Contador de Hist\xF3rias",
        voiceName: "Charon",
        startSec: 24.413,
        endSec: 42.14
      },
      {
        turnId: "apf-t4",
        speaker: "O Jovem Patinho",
        voiceName: "Puck",
        startSec: 42.48,
        endSec: 52.304
      },
      {
        turnId: "apf-t5",
        speaker: "O Cisne Real",
        voiceName: "Zephyr",
        startSec: 52.304,
        endSec: 62.28
      }
    ],
    cacheKey: "andersen-patinho-feio-mv-bebf3a19a6217735",
    fileSizeBytes: 2989484,
    createdAt: "2026-11-20T01:00:32.183Z",
    audioUrl: "/audio-cache/andersen-patinho-feio-mv-bebf3a19a6217735.wav"
  }
};

// server/audioCache.ts
var BUNDLED_CACHE_DIR = path.resolve(process.cwd(), "data", "audio-cache");
var PUBLIC_CACHE_DIR = path.resolve(process.cwd(), "public", "audio-cache");
var IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
var WRITABLE_CACHE_DIR = IS_SERVERLESS ? path.join(os.tmpdir(), "voz-e-folha", "audio-cache") : BUNDLED_CACHE_DIR;
function ensureWritableDir(dir = WRITABLE_CACHE_DIR) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch {
  }
}
function sanitizeKey(cacheKey) {
  if (!/^[a-zA-Z0-9_-]{4,128}$/.test(cacheKey)) {
    throw new Error("Chave de cache inv\xE1lida.");
  }
  return cacheKey;
}
function getWavFilePath(cacheKey) {
  const safe = sanitizeKey(cacheKey);
  ensureWritableDir();
  const writableWav = path.join(WRITABLE_CACHE_DIR, `${safe}.wav`);
  if (fs.existsSync(writableWav)) {
    return writableWav;
  }
  const bundledWav = path.join(BUNDLED_CACHE_DIR, `${safe}.wav`);
  if (fs.existsSync(bundledWav)) {
    return bundledWav;
  }
  const publicWav = path.join(PUBLIC_CACHE_DIR, `${safe}.wav`);
  if (fs.existsSync(publicWav)) {
    return publicWav;
  }
  return writableWav;
}
function resolveMetaFilePath(cacheKey) {
  const safe = sanitizeKey(cacheKey);
  ensureWritableDir();
  const writableMeta = path.join(WRITABLE_CACHE_DIR, `${safe}.json`);
  if (fs.existsSync(writableMeta)) {
    return writableMeta;
  }
  const bundledMeta = path.join(BUNDLED_CACHE_DIR, `${safe}.json`);
  if (fs.existsSync(bundledMeta)) {
    return bundledMeta;
  }
  const publicMeta = path.join(PUBLIC_CACHE_DIR, `${safe}.json`);
  if (fs.existsSync(publicMeta)) {
    return publicMeta;
  }
  return writableMeta;
}
function readCachedAudio(cacheKey) {
  try {
    const safe = sanitizeKey(cacheKey);
    const staticEntry = STATIC_PRERENDERED_AUDIOS[safe];
    if (staticEntry) {
      return staticEntry;
    }
    const wavPath = getWavFilePath(safe);
    const metaPath = resolveMetaFilePath(safe);
    if (!fs.existsSync(wavPath) || !fs.existsSync(metaPath)) {
      return null;
    }
    const raw = fs.readFileSync(metaPath, "utf-8");
    const parsed = JSON.parse(raw);
    const stats = fs.statSync(wavPath);
    if (stats.size < 44) {
      return null;
    }
    return {
      ...parsed,
      fileSizeBytes: stats.size,
      audioUrl: `/api/audio/${safe}`
    };
  } catch {
    const safe = cacheKey.replace(/[^a-zA-Z0-9_-]/g, "");
    return STATIC_PRERENDERED_AUDIOS[safe] ?? null;
  }
}
function writeCachedAudio(cacheKey, wavBytes, metadata) {
  const safe = sanitizeKey(cacheKey);
  ensureWritableDir();
  const wavPath = path.join(WRITABLE_CACHE_DIR, `${safe}.wav`);
  const metaPath = path.join(WRITABLE_CACHE_DIR, `${safe}.json`);
  const tmpWavPath = `${wavPath}.tmp`;
  const tmpMetaPath = `${metaPath}.tmp`;
  const fullMeta = {
    ...metadata,
    cacheKey: safe,
    fileSizeBytes: wavBytes.byteLength,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    audioUrl: `/api/audio/${safe}`
  };
  fs.writeFileSync(tmpWavPath, wavBytes);
  fs.renameSync(tmpWavPath, wavPath);
  fs.writeFileSync(tmpMetaPath, JSON.stringify(fullMeta, null, 2), "utf-8");
  fs.renameSync(tmpMetaPath, metaPath);
  return fullMeta;
}
function listCachedAudios() {
  ensureWritableDir();
  const candidateDirs = Array.from(
    /* @__PURE__ */ new Set([WRITABLE_CACHE_DIR, BUNDLED_CACHE_DIR, PUBLIC_CACHE_DIR])
  );
  const seenKeys = /* @__PURE__ */ new Set();
  const items = [];
  let totalSizeBytes = 0;
  for (const staticMeta of Object.values(STATIC_PRERENDERED_AUDIOS)) {
    seenKeys.add(staticMeta.cacheKey);
    items.push({ ...staticMeta, exists: true });
    totalSizeBytes += staticMeta.fileSizeBytes;
  }
  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const key = file.slice(0, -5);
      if (seenKeys.has(key)) continue;
      const meta = readCachedAudio(key);
      if (meta) {
        seenKeys.add(key);
        items.push({ ...meta, exists: true });
        totalSizeBytes += meta.fileSizeBytes;
      }
    }
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    items,
    totalSizeBytes,
    count: items.length
  };
}
function deleteCachedAudio(cacheKey) {
  const safe = sanitizeKey(cacheKey);
  ensureWritableDir();
  const wavPath = path.join(WRITABLE_CACHE_DIR, `${safe}.wav`);
  const metaPath = path.join(WRITABLE_CACHE_DIR, `${safe}.json`);
  let removed = false;
  try {
    if (fs.existsSync(wavPath)) {
      fs.unlinkSync(wavPath);
      removed = true;
    }
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
      removed = true;
    }
  } catch {
  }
  clearPartialBatchCache(safe);
  return removed;
}
function getPartialsDir(cacheKey) {
  ensureWritableDir();
  return path.join(WRITABLE_CACHE_DIR, "partials", sanitizeKey(cacheKey));
}
function getPartialBatchPath(cacheKey, batchIndex, fingerprint) {
  const safeFp = fingerprint.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "batch";
  return path.join(getPartialsDir(cacheKey), `b${batchIndex}-${safeFp}.wav`);
}
function readPartialBatchWav(cacheKey, batchIndex, fingerprint) {
  try {
    const filePath = getPartialBatchPath(cacheKey, batchIndex, fingerprint);
    if (!fs.existsSync(filePath)) return null;
    const stats = fs.statSync(filePath);
    if (stats.size < 44) return null;
    return new Uint8Array(fs.readFileSync(filePath));
  } catch {
    return null;
  }
}
function writePartialBatchWav(cacheKey, batchIndex, fingerprint, wavBytes) {
  try {
    const dir = getPartialsDir(cacheKey);
    ensureWritableDir(dir);
    const filePath = getPartialBatchPath(cacheKey, batchIndex, fingerprint);
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, wavBytes);
    fs.renameSync(tmpPath, filePath);
  } catch {
  }
}
function clearPartialBatchCache(cacheKey) {
  try {
    const dir = getPartialsDir(cacheKey);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch {
  }
}

// server/bookLibrary.ts
import fs2 from "node:fs";
import os2 from "node:os";
import path2 from "node:path";

// src/data/books.ts
var PUBLIC_DOMAIN_BOOKS = [
  {
    id: "fabulas-esopo",
    title: "F\xE1bulas de Esopo",
    author: "Esopo",
    year: 1884,
    publicDomainSource: "Dom\xEDnio P\xFAblico \xB7 Tradi\xE7\xE3o Cl\xE1ssica (Edi\xE7\xE3o Ilustrada)",
    coverUrl: "/src/assets/images/cover_fabulas_esopo_1795135333187.jpg",
    synopsis: "Pequenas hist\xF3rias imortais protagonizadas por animais falantes, pr\xE9-ajustadas por IA com vozes distintas, pausas dram\xE1ticas e ensinamentos atemporais para todas as idades.",
    chapters: [
      {
        id: "esopo-cigarra-formiga",
        bookId: "fabulas-esopo",
        number: 1,
        roman: "I",
        numberLabel: "F\xE1bula I",
        title: "A Cigarra e a Formiga",
        estimatedMinutes: 2,
        wordCount: 185,
        characterCount: 3,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: "Quem pensa no amanh\xE3 com zelo colhe abrigo quando o inverno chega, mas a arte e a compaix\xE3o tamb\xE9m aquecem a vida.",
        aiNotes: "Roteiro pr\xE9-ajustado por IA \xB7 3 timbres contrastantes (Charon, Zephyr, Kore) e cad\xEAncia de f\xE1bula cl\xE1ssica",
        summary: "Durante todo o ver\xE3o, a Cigarra encanta o bosque com sua cantoria enquanto a Formiga trabalha sem descanso; com a chegada do inverno, as duas se encontram.",
        characters: [
          {
            name: "Contador de Hist\xF3rias",
            role: "narrator",
            description: "Narrador caloroso e pausado de contos infantis.",
            defaultVoice: "Charon",
            defaultStyle: "Contador de hist\xF3rias brasileiro acolhedor, voz calma e expressiva para crian\xE7as e fam\xEDlias"
          },
          {
            name: "A Cigarra",
            role: "character",
            description: "Artista do bosque, musical, sonhadora e depois tr\xEAmula de frio.",
            defaultVoice: "Zephyr",
            defaultStyle: "Voz leve, musical e expressiva em portugu\xEAs brasileiro, passando da alegria ao frio do inverno"
          },
          {
            name: "A Formiga",
            role: "character",
            description: "Trabalhadora previdente, pr\xE1tica e de cora\xE7\xE3o justo.",
            defaultVoice: "Kore",
            defaultStyle: "Voz feminina clara, firme e maternal em portugu\xEAs brasileiro"
          }
        ],
        turns: [
          {
            id: "ecf-t1",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Tom caloroso de era uma vez, desenhando a paisagem ensolarada do bosque",
            text: "Durante todo o ver\xE3o dourado, enquanto o sol amadurecia o trigo nos campos, a Cigarra pousava nos ramos mais altos e cantava do amanhecer ao p\xF4r do sol. L\xE1 no ch\xE3o, a pequena Formiga caminhava em fila, carregando gr\xE3o ap\xF3s gr\xE3o para o seu formigueiro.",
            pauseAfterMs: 340
          },
          {
            id: "ecf-t2",
            speaker: "A Cigarra",
            role: "character",
            style: "Tom alegre, cantarolante e despreocupado sob o sol de ver\xE3o",
            text: "Amiga Formiga, largue esse fardo pesado um instante! Veja como o c\xE9u est\xE1 azul e ou\xE7a a can\xE7\xE3o que compus para a brisa da tarde!",
            pauseAfterMs: 280
          },
          {
            id: "ecf-t3",
            speaker: "A Formiga",
            role: "character",
            style: "Tom apressado, pr\xE1tico mas gentil, enxugando o suor da testa",
            text: "Sua m\xFAsica \xE9 bela, dona Cigarra, mas o ver\xE3o n\xE3o dura para sempre. Preciso encher nossa despensa antes que os ventos gelados soprem do norte.",
            pauseAfterMs: 360
          },
          {
            id: "ecf-t4",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Voz mais grave e suave, anunciando a chegada da neve e do frio",
            text: "As folhas ca\xEDram, a geada cobriu a relva de branco e a Cigarra, sem um \xFAnico gr\xE3o para comer e com as asas geladas, bateu timidamente \xE0 porta do formigueiro.",
            pauseAfterMs: 300
          },
          {
            id: "ecf-t5",
            speaker: "A Cigarra",
            role: "character",
            style: "Voz humilde e tr\xEAmula de frio, pedindo abrigo com sinceridade",
            text: "Por favor, vizinha Formiga, d\xEA-me um pouco de abrigo e alguns gr\xE3os de trigo at\xE9 a primavera voltar.",
            pauseAfterMs: 260
          },
          {
            id: "ecf-t6",
            speaker: "A Formiga",
            role: "character",
            style: "Tom primeiro severo e curioso, depois suavizando com hospitalidade",
            text: "E o que voc\xEA fez durante todo o tempo bom, enquanto n\xF3s recolh\xEDamos mantimentos? Ah, cantou para alegrar a floresta inteira? Pois entre, aque\xE7a-se junto ao fogo e aprenda: h\xE1 tempo de cantar e tempo de guardar para o amanh\xE3.",
            pauseAfterMs: 320
          }
        ]
      },
      {
        id: "esopo-lebre-tartaruga",
        bookId: "fabulas-esopo",
        number: 2,
        roman: "II",
        numberLabel: "F\xE1bula II",
        title: "A Lebre e a Tartaruga",
        estimatedMinutes: 2,
        wordCount: 205,
        characterCount: 3,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: "Devagar e com const\xE2ncia chega-se mais longe do que com pressa e vaidade.",
        aiNotes: "Roteiro pr\xE9-ajustado por IA \xB7 Contraste r\xEDtmico entre a Lebre veloz (Puck) e a Tartaruga serena (Kore)",
        summary: "Cansada das zombarias da Lebre veloz, a paciente Tartaruga prop\xF5e uma corrida at\xE9 o velho carvalho da colina.",
        characters: [
          {
            name: "Contador de Hist\xF3rias",
            role: "narrator",
            description: "Narrador envolvente que conduz a emo\xE7\xE3o da corrida.",
            defaultVoice: "Charon",
            defaultStyle: "Contador de hist\xF3rias expressivo, alternando suspense e bom humor"
          },
          {
            name: "A Lebre",
            role: "character",
            description: "Corredora veloz, vaidosa e confiante demais.",
            defaultVoice: "Puck",
            defaultStyle: "Voz jovem, r\xE1pida, gabola e cheia de energia em portugu\xEAs brasileiro"
          },
          {
            name: "A Tartaruga",
            role: "character",
            description: "Caminhante calma, perseverante e s\xE1bia.",
            defaultVoice: "Kore",
            defaultStyle: "Voz serena, pausada, firme e confiante em portugu\xEAs brasileiro"
          }
        ],
        turns: [
          {
            id: "elt-t1",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Tom vivo e divertido, apresentando os animais da clareira",
            text: "Em toda a clareira do bosque, ningu\xE9m corria t\xE3o depressa quanto a Lebre. Orgulhosa de suas patas ligeiras, ela vivia rindo do passo vagaroso da dona Tartaruga.",
            pauseAfterMs: 300
          },
          {
            id: "elt-t2",
            speaker: "A Lebre",
            role: "character",
            style: "Fala r\xE1pida, risonha e provocadora",
            text: "Com essas patinhas curtas, amiga Tartaruga, quando voc\xEA chegar ao riacho o dia j\xE1 ter\xE1 virado noite!",
            pauseAfterMs: 260
          },
          {
            id: "elt-t3",
            speaker: "A Tartaruga",
            role: "character",
            style: "Tom calmo, sorridente e determinado, sem perder a compostura",
            text: "Voc\xEA corre como o vento, dona Lebre, mas aceito apostar uma corrida com voc\xEA at\xE9 o grande carvalho no alto da colina.",
            pauseAfterMs: 320
          },
          {
            id: "elt-t4",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Narrador din\xE2mico, descrevendo a largada e o cochilo da Lebre",
            text: "Dada a largada pela Raposa, a Lebre disparou como uma flecha e logo perdeu a rival de vista. Vendo-se t\xE3o adiante, deitou-se \xE0 sombra fresca de uma macieira para tirar uma soneca. Enquanto isso, passo a passo, sem parar um s\xF3 instante, a Tartaruga subiu a estrada poeirenta.",
            pauseAfterMs: 360
          },
          {
            id: "elt-t5",
            speaker: "A Lebre",
            role: "character",
            style: "Acordando no susto, ofegante e incr\xE9dula",
            text: "Espere! Como \xE9 poss\xEDvel? Eu s\xF3 fechei os olhos por um minutinho!",
            pauseAfterMs: 260
          },
          {
            id: "elt-t6",
            speaker: "A Tartaruga",
            role: "character",
            style: "Voz mansa e vitoriosa ao cruzar a linha de chegada",
            text: "Passo ap\xF3s passo, sem desistir no meio do caminho, qualquer colina se alcan\xE7a.",
            pauseAfterMs: 320
          }
        ]
      },
      {
        id: "esopo-leao-ratinho",
        bookId: "fabulas-esopo",
        number: 3,
        roman: "III",
        numberLabel: "F\xE1bula III",
        title: "O Le\xE3o e o Ratinho",
        estimatedMinutes: 2,
        wordCount: 192,
        characterCount: 3,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: "Nenhum gesto de bondade \xE9 em v\xE3o: at\xE9 os menores amigos podem salvar os mais fortes.",
        aiNotes: "Roteiro pr\xE9-ajustado por IA \xB7 Contraste dram\xE1tico entre o rugido grave de Fenrir e a voz mi\xFAda de Puck",
        summary: "Poupado pelo rei da selva, um pequenino rato promete retribuir o favor \u2014 e cumpre a promessa quando o Le\xE3o cai na rede dos ca\xE7adores.",
        characters: [
          {
            name: "Contador de Hist\xF3rias",
            role: "narrator",
            description: "Narrador cl\xE1ssico de f\xE1bulas.",
            defaultVoice: "Charon",
            defaultStyle: "Narrador sereno e envolvente em portugu\xEAs brasileiro"
          },
          {
            name: "O Le\xE3o",
            role: "character",
            description: "Rei imponente da floresta, de voz trovejante e cora\xE7\xE3o nobre.",
            defaultVoice: "Fenrir",
            defaultStyle: "Voz profunda, grave e majestosa em portugu\xEAs brasileiro"
          },
          {
            name: "O Ratinho",
            role: "character",
            description: "Pequenino morador da relva, corajoso e fiel \xE0 palavra dada.",
            defaultVoice: "Puck",
            defaultStyle: "Voz aguda, r\xE1pida, sincera e corajosa em portugu\xEAs brasileiro"
          }
        ],
        turns: [
          {
            id: "elr-t1",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Tom descritivo e solene na floresta silenciosa",
            text: "Um grande Le\xE3o dormia tranquilo \xE0 sombra de uma figueira quando um Ratinho distra\xEDdo correu sobre sua juba. Despertando com um rugido, o rei da floresta prendeu o pequeno sob sua enorme pata.",
            pauseAfterMs: 300
          },
          {
            id: "elr-t2",
            speaker: "O Ratinho",
            role: "character",
            style: "Voz suplicante, r\xE1pida e cheia de respeito",
            text: "Perdoe-me, Majestade! N\xE3o tive inten\xE7\xE3o de acord\xE1-lo. Se poupar a minha vida hoje, prometo que um dia serei \xFAtil ao senhor!",
            pauseAfterMs: 280
          },
          {
            id: "elr-t3",
            speaker: "O Le\xE3o",
            role: "character",
            style: "Voz grave e divertida, com um riso generoso",
            text: "Voc\xEA, t\xE3o pequenino, ajudar o rei da floresta? V\xE1 em paz, pequeno amigo, sua coragem me fez sorrir.",
            pauseAfterMs: 360
          },
          {
            id: "elr-t4",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Tom de tens\xE3o e urg\xEAncia na mata",
            text: "Poucos dias depois, o Le\xE3o caiu numa forte rede de cordas armada por ca\xE7adores. Quanto mais lutava, mais os n\xF3s apertavam. Ouvindo seu rugido de longe, o Ratinho veio correndo pela relva.",
            pauseAfterMs: 300
          },
          {
            id: "elr-t5",
            speaker: "O Ratinho",
            role: "character",
            style: "Tom decidido e leal, pronto para agir",
            text: "Fique quietinho, Majestade! Meus dentes s\xE3o pequenos, mas sabem roer a corda mais grossa!",
            pauseAfterMs: 280
          },
          {
            id: "elr-t6",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Desfecho luminoso e afetuoso",
            text: "Em poucos minutos, malha ap\xF3s malha se rompeu e o Le\xE3o voltou a caminhar livre, aprendendo que n\xE3o existe amigo pequeno demais.",
            pauseAfterMs: 300
          }
        ]
      },
      {
        id: "esopo-raposa-uvas",
        bookId: "fabulas-esopo",
        number: 4,
        roman: "IV",
        numberLabel: "F\xE1bula IV",
        title: "A Raposa e as Uvas",
        estimatedMinutes: 1,
        wordCount: 155,
        characterCount: 2,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: "\xC9 f\xE1cil desdenhar daquilo que n\xE3o conseguimos alcan\xE7ar.",
        aiNotes: "Roteiro pr\xE9-ajustado por IA \xB7 Dire\xE7\xE3o teatral de orgulho disfar\xE7ado na voz da Raposa (Zephyr)",
        summary: "Faminta numa tarde quente, uma Raposa tenta de todas as formas alcan\xE7ar um cacho de uvas maduras no alto da parreira.",
        characters: [
          {
            name: "Contador de Hist\xF3rias",
            role: "narrator",
            description: "Narrador observador e bem-humorado.",
            defaultVoice: "Charon",
            defaultStyle: "Narrador elegante e levemente bem-humorado em portugu\xEAs brasileiro"
          },
          {
            name: "A Raposa",
            role: "character",
            description: "Astuta, orgulhosa e mestre em inventar desculpas elegantes.",
            defaultVoice: "Zephyr",
            defaultStyle: "Voz expressiva, primeiro entusiasmada e depois fingindo desd\xE9m aristocr\xE1tico"
          }
        ],
        turns: [
          {
            id: "eru-t1",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Tom vivo e descritivo sob o calor da tarde",
            text: "Numa tarde quente de fim de ver\xE3o, uma Raposa passeava perto de um pomar quando avistou, pendurado no alto de uma parreira, o cacho de uvas mais roxo e brilhante que j\xE1 vira.",
            pauseAfterMs: 300
          },
          {
            id: "eru-t2",
            speaker: "A Raposa",
            role: "character",
            style: "Voz encantada e com \xE1gua na boca",
            text: "Que maravilha! Doces, frescas e no ponto exato para matar a minha sede. Basta um salto certeiro!",
            pauseAfterMs: 300
          },
          {
            id: "eru-t3",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Ritmo cadenciado acompanhando cada tentativa frustrada",
            text: "Ela tomou dist\xE2ncia, correu e saltou \u2014 mas suas patas tocaram apenas o ar. Tentou uma segunda, uma terceira e uma quarta vez, at\xE9 cair sentada na poeira, sem f\xF4lego. Olhando ao redor para ver se algum p\xE1ssaro a observava, ergueu o focinho com ar solene.",
            pauseAfterMs: 340
          },
          {
            id: "eru-t4",
            speaker: "A Raposa",
            role: "character",
            style: "Tom de superioridade fingida e orgulho ferido",
            text: "Pensando bem, olhando mais de perto... est\xE3o verdes demais e certamente azedas. N\xE3o servem para o paladar refinado de uma raposa como eu.",
            pauseAfterMs: 300
          }
        ]
      },
      {
        id: "esopo-corvo-raposa",
        bookId: "fabulas-esopo",
        number: 5,
        roman: "V",
        numberLabel: "F\xE1bula V",
        title: "O Corvo e a Raposa",
        estimatedMinutes: 2,
        wordCount: 175,
        characterCount: 3,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: "Desconfie dos bajuladores: quem elogia demais quase sempre est\xE1 de olho no seu queijo.",
        aiNotes: "Roteiro pr\xE9-ajustado por IA \xB7 Bajula\xE7\xE3o melodiosa da Raposa (Zephyr) contra a vaidade do Corvo (Fenrir)",
        summary: "Pousado num galho com um belo peda\xE7o de queijo no bico, o Corvo ouve os elogios irresist\xEDveis da Raposa.",
        characters: [
          {
            name: "Contador de Hist\xF3rias",
            role: "narrator",
            description: "Narrador cl\xE1ssico de f\xE1bulas.",
            defaultVoice: "Charon",
            defaultStyle: "Contador de hist\xF3rias expressivo e ir\xF4nico na medida certa"
          },
          {
            name: "A Raposa",
            role: "character",
            description: "Mestre da lisonja e da l\xE1bia.",
            defaultVoice: "Zephyr",
            defaultStyle: "Voz sedutora, doce e teatralmente elogiosa em portugu\xEAs brasileiro"
          },
          {
            name: "O Corvo",
            role: "character",
            description: "Ave vaidosa que sonha em ser reconhecida pelo canto.",
            defaultVoice: "Fenrir",
            defaultStyle: "Voz grave, estufando o peito de orgulho"
          }
        ],
        turns: [
          {
            id: "ecr-t1",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Narrador apresentando a cena no alto do pinheiro",
            text: "Senhor Corvo estava pousado no galho de um pinheiro, segurando no bico um generoso peda\xE7o de queijo amarelo. Atra\xEDda pelo aroma, a Raposa aproximou-se devagarinho do tronco.",
            pauseAfterMs: 300
          },
          {
            id: "ecr-t2",
            speaker: "A Raposa",
            role: "character",
            style: "Tom meloso, admirado e cheio de rever\xEAncia teatral",
            text: "Bom dia, nobre dom Corvo! Que plumagem reluzente como a noite, que porte real! Se a sua voz for t\xE3o bela quanto as suas penas, o senhor \xE9, sem d\xFAvida, a f\xEAnix de toda esta floresta!",
            pauseAfterMs: 320
          },
          {
            id: "ecr-t3",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Tom divertido descrevendo a vaidade do Corvo",
            text: "Ao ouvir tamanho elogio, o Corvo sentiu o cora\xE7\xE3o inchar de vaidade. Querendo mostrar que tamb\xE9m sabia cantar como um rouxinol, abriu bem o bico.",
            pauseAfterMs: 280
          },
          {
            id: "ecr-t4",
            speaker: "O Corvo",
            role: "character",
            style: "Soltando a voz com pompa e deixando escapar o queijo",
            text: "C\xE1\xE1\xE1! Veja s\xF3 como a minha voz ecoa pelo bosque!",
            pauseAfterMs: 260
          },
          {
            id: "ecr-t5",
            speaker: "A Raposa",
            role: "character",
            style: "Tom esperto e satisfeito ap\xF3s apanhar o queijo no ar",
            text: "Obrigada pelo lanche, meu caro cantor! Sua voz \xE9 forte, n\xE3o nego, mas faltou um pouquinho de ju\xEDzo. Em troca do queijo, deixo-lhe uma li\xE7\xE3o: nunca abra o bico para quem vive de bajula\xE7\xE3o.",
            pauseAfterMs: 320
          }
        ]
      },
      {
        id: "esopo-rato-campo-cidade",
        bookId: "fabulas-esopo",
        number: 6,
        roman: "VI",
        numberLabel: "F\xE1bula VI",
        title: "O Rato do Campo e o Rato da Cidade",
        estimatedMinutes: 2,
        wordCount: 198,
        characterCount: 3,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: "Mais vale uma refei\xE7\xE3o simples saboreada em paz do que um banquete cercado de sobressaltos.",
        aiNotes: "Roteiro pr\xE9-ajustado por IA \xB7 Contraste entre a simplicidade serena do campo (Kore) e a agita\xE7\xE3o urbana (Puck)",
        summary: "Convidado pelo primo da cidade para provar as iguarias de um pal\xE1cio, o Rato do Campo descobre o pre\xE7o do luxo.",
        characters: [
          {
            name: "Contador de Hist\xF3rias",
            role: "narrator",
            description: "Narrador acolhedor das f\xE1bulas de Esopo.",
            defaultVoice: "Charon",
            defaultStyle: "Voz narrativa calorosa e descritiva em portugu\xEAs brasileiro"
          },
          {
            name: "Rato do Campo",
            role: "character",
            description: "Hospitaleiro, amante da tranquilidade e da natureza.",
            defaultVoice: "Kore",
            defaultStyle: "Voz mansa, acolhedora e sincera"
          },
          {
            name: "Rato da Cidade",
            role: "character",
            description: "Sofisticado, apressado e acostumado aos perigos da mans\xE3o.",
            defaultVoice: "Puck",
            defaultStyle: "Voz \xE1gil, entusiasmada e um pouco esnobe"
          }
        ],
        turns: [
          {
            id: "ercc-t1",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Tom aconchegante descrevendo a toca entre as ra\xEDzes",
            text: "Era uma vez um Rato do Campo que recebeu em sua toca humilde a visita do primo, o Rato da Cidade. Com alegria, serviu-lhe ra\xEDzes doces, gr\xE3os de cevada e nozes silvestres.",
            pauseAfterMs: 300
          },
          {
            id: "ercc-t2",
            speaker: "Rato da Cidade",
            role: "character",
            style: "Tom educado mas inconformado com a comida simples",
            text: "Primo querido, como voc\xEA consegue viver apenas de gr\xE3os secos e ra\xEDzes? Venha comigo hoje mesmo para a cidade! L\xE1 moro num sal\xE3o com tapetes macios e mesas fartas de queijos finos, bolos e mel.",
            pauseAfterMs: 320
          },
          {
            id: "ercc-t3",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Mudando o ritmo para o suspense do banquete noturno",
            text: "\xC0 meia-noite, os dois entraram na sala de jantar de uma grande casa. Havia tortas, frutas cristalizadas e queijos perfumados. Mas, mal o Rato do Campo deu a primeira mordida, a porta se abriu com estrondo e dois enormes c\xE3es de guarda entraram latindo.",
            pauseAfterMs: 320
          },
          {
            id: "ercc-t4",
            speaker: "Rato da Cidade",
            role: "character",
            style: "Sussurro urgente e ofegante enquanto corre",
            text: "R\xE1pido, primo, para tr\xE1s do rodap\xE9! N\xE3o fa\xE7a barulho!",
            pauseAfterMs: 260
          },
          {
            id: "ercc-t5",
            speaker: "Rato do Campo",
            role: "character",
            style: "Com o cora\xE7\xE3o batendo forte, despedindo-se com sabedoria serena",
            text: "Adeus, primo! Seus bolos e queijos s\xE3o deliciosos, mas prefiro mil vezes meus gr\xE3os de cevada l\xE1 no bosque, onde posso jantar em paz e sem medo.",
            pauseAfterMs: 320
          }
        ]
      }
    ]
  },
  {
    id: "contos-grimm-perrault",
    title: "Contos Cl\xE1ssicos da Floresta",
    author: "Irm\xE3os Grimm & Charles Perrault",
    year: 1812,
    publicDomainSource: "Dom\xEDnio P\xFAblico \xB7 Contos de Fadas Tradicionais",
    coverUrl: "/src/assets/images/cover_contos_grimm_1795135334281.jpg",
    synopsis: "Os grandes contos infantis da tradi\xE7\xE3o europeia em vers\xF5es integrais para leitura em fam\xEDlia, pr\xE9-ajustados por IA com elenco completo de vozes naturais.",
    chapters: [
      {
        id: "grimm-chapeuzinho",
        bookId: "contos-grimm-perrault",
        number: 1,
        roman: "I",
        numberLabel: "Conto I",
        title: "Chapeuzinho Vermelho",
        estimatedMinutes: 3,
        wordCount: 245,
        characterCount: 4,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: "Escutar os bons conselhos e manter-se atento ao caminho protege contra os atalhos enganosos.",
        aiNotes: "Roteiro pr\xE9-ajustado por IA \xB7 4 vozes dramatizadas incluindo o di\xE1logo cl\xE1ssico na casa da vov\xF3",
        summary: "Ao atravessar o bosque para levar bolinhos \xE0 av\xF3 doente, uma menina de capuz vermelho encontra um Lobo de fala mansa.",
        characters: [
          {
            name: "Contador de Hist\xF3rias",
            role: "narrator",
            description: "Narrador tradicional dos contos da floresta.",
            defaultVoice: "Charon",
            defaultStyle: "Narrador brasileiro cl\xE1ssico de contos de fadas, envolvente e protetor"
          },
          {
            name: "Chapeuzinho Vermelho",
            role: "character",
            description: "Menina alegre, curiosa e carinhosa.",
            defaultVoice: "Zephyr",
            defaultStyle: "Voz infantil doce, curiosa e expressiva em portugu\xEAs brasileiro"
          },
          {
            name: "O Lobo",
            role: "character",
            description: "Astuto morador da mata que tenta afinar a voz grossa.",
            defaultVoice: "Fenrir",
            defaultStyle: "Voz grave, fingindo suavidade e mist\xE9rio teatral"
          },
          {
            name: "A Vov\xF3 e o Ca\xE7ador",
            role: "character",
            description: "Vozes acolhedoras do resgate feliz na cabana.",
            defaultVoice: "Kore",
            defaultStyle: "Voz calorosa, aliviada e protetora"
          }
        ],
        turns: [
          {
            id: "gcv-t1",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Abertura encantada de conto de fadas cl\xE1ssico",
            text: "Era uma vez uma menina t\xE3o querida por todos que sua av\xF3 lhe costurou um pequeno capuz de veludo vermelho. Certa manh\xE3, sua m\xE3e colocou numa cesta p\xE3o fresco, bolo e mel, pedindo-lhe que fosse visitar a vov\xF3 doente pela trilha principal do bosque.",
            pauseAfterMs: 340
          },
          {
            id: "gcv-t2",
            speaker: "O Lobo",
            role: "character",
            style: "Voz grave fingindo do\xE7ura e educa\xE7\xE3o entre as \xE1rvores",
            text: "Bom dia, Chapeuzinho Vermelho! Para onde vai t\xE3o cedo com essa cesta t\xE3o cheirosa? Veja quantas flores silvestres brilham ali fora da trilha!",
            pauseAfterMs: 280
          },
          {
            id: "gcv-t3",
            speaker: "Chapeuzinho Vermelho",
            role: "character",
            style: "Voz inocente e animada",
            text: "Vou \xE0 casa da vov\xF3, logo depois do moinho! Vou colher um ramalhete colorido para alegrar a janela dela.",
            pauseAfterMs: 340
          },
          {
            id: "gcv-t4",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Suspense suave de hist\xF3ria infantil ao chegar \xE0 cabana",
            text: "Enquanto a menina colhia flores, o Lobo correu pelo atalho, trancou a vov\xF3 no arm\xE1rio seguro e vestiu a touca dela, deitando-se sob o cobertor. Quando Chapeuzinho entrou na cabana, estranhou a figura na cama.",
            pauseAfterMs: 300
          },
          {
            id: "gcv-t5",
            speaker: "Chapeuzinho Vermelho",
            role: "character",
            style: "Voz surpresa e cheia de espanto crescente",
            text: "Oh, vov\xF3, que orelhas t\xE3o grandes voc\xEA tem! E que olhos enormes! E vov\xF3... que boca t\xE3o grande \xE9 essa?",
            pauseAfterMs: 260
          },
          {
            id: "gcv-t6",
            speaker: "O Lobo",
            role: "character",
            style: "Come\xE7ando com voz disfar\xE7ada e terminando num rugido teatral",
            text: "As orelhas s\xE3o para te ouvir melhor, os olhos s\xE3o para te ver melhor... e a boca \xE9 para comer todo esse bolo da sua cesta!",
            pauseAfterMs: 300
          },
          {
            id: "gcv-t7",
            speaker: "A Vov\xF3 e o Ca\xE7ador",
            role: "character",
            style: "Tom her\xF3ico e acolhedor no desfecho feliz",
            text: "Alto l\xE1, seu Lobo trapaceiro! O guarda-florestal abriu a porta bem a tempo, p\xF4s o Lobo para correr de volta para a serra e libertou a vov\xF3, que comemorou com Chapeuzinho tomando ch\xE1 quente e bolo de mel.",
            pauseAfterMs: 320
          }
        ]
      },
      {
        id: "grimm-tres-porquinhos",
        bookId: "contos-grimm-perrault",
        number: 2,
        roman: "II",
        numberLabel: "Conto II",
        title: "Os Tr\xEAs Porquinhos",
        estimatedMinutes: 3,
        wordCount: 230,
        characterCount: 4,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: "O trabalho bem-feito e constru\xEDdo com paci\xEAncia resiste a qualquer tempestade.",
        aiNotes: "Roteiro pr\xE9-ajustado por IA \xB7 Sopro dram\xE1tico do Lobo (Fenrir) e vozes distintas para os irm\xE3os",
        summary: "Tr\xEAs irm\xE3os decidem construir suas pr\xF3prias casas na orla da floresta: uma de palha, uma de madeira e uma de tijolos.",
        characters: [
          {
            name: "Contador de Hist\xF3rias",
            role: "narrator",
            description: "Narrador ritmado e expressivo.",
            defaultVoice: "Charon",
            defaultStyle: "Narrador caloroso e ritmado em portugu\xEAs brasileiro"
          },
          {
            name: "C\xEDcero e Heitor",
            role: "character",
            description: "Os dois irm\xE3os apressados que queriam brincar logo.",
            defaultVoice: "Puck",
            defaultStyle: "Voz jovem, brincalhona e despreocupada"
          },
          {
            name: "Pr\xE1tico",
            role: "character",
            description: "O irm\xE3o construtor, paciente e engenhoso.",
            defaultVoice: "Kore",
            defaultStyle: "Voz clara, sensata e confiante"
          },
          {
            name: "O Lobo Soprador",
            role: "character",
            description: "Lobo de f\xF4lego forte que testa cada parede.",
            defaultVoice: "Fenrir",
            defaultStyle: "Voz trovejante e teatral, enchendo o peito de ar"
          }
        ],
        turns: [
          {
            id: "gtp-t1",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Tom alegre apresentando os tr\xEAs irm\xE3os",
            text: "Tr\xEAs irm\xE3os porquinhos partiram pelo vale para erguer suas pr\xF3prias casinhas. O primeiro escolheu palha dourada; o segundo juntou galhos de madeira; j\xE1 o terceiro, chamado Pr\xE1tico, assentou tijolo por tijolo com cimento firme.",
            pauseAfterMs: 320
          },
          {
            id: "gtp-t2",
            speaker: "C\xEDcero e Heitor",
            role: "character",
            style: "Tom festivo e apressado, tocando flauta",
            text: "Nossas cabanas ficaram prontas antes do almo\xE7o! Vamos dan\xE7ar no prado, irm\xE3o Pr\xE1tico, voc\xEA trabalha demais!",
            pauseAfterMs: 280
          },
          {
            id: "gtp-t3",
            speaker: "Pr\xE1tico",
            role: "character",
            style: "Tom paciente e previdente enquanto alisa o reboco",
            text: "Divirtam-se, irm\xE3os, mas prefiro terminar meu telhado e minha chamin\xE9 de pedra. Quando o vento ou o Lobo vierem, teremos um porto seguro.",
            pauseAfterMs: 340
          },
          {
            id: "gtp-t4",
            speaker: "O Lobo Soprador",
            role: "character",
            style: "Voz profunda e teatral batendo \xE0 porta",
            text: "Abram esta porta, porquinhos! Se n\xE3o abrirem, vou estufar o peito, vou soprar e a cabana vai voar!",
            pauseAfterMs: 300
          },
          {
            id: "gtp-t5",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Ritmo empolgante descrevendo a correria para a casa de tijolos",
            text: "Com dois sopros fortes, a cabana de palha e a cabana de madeira voaram pelos ares. Os dois irm\xE3os correram a toda velocidade e entraram na casa de tijolos de Pr\xE1tico, que trancou a porta de carvalho. O Lobo soprou at\xE9 ficar roxo, mas nem um \xFAnico tijolo se moveu.",
            pauseAfterMs: 320
          },
          {
            id: "gtp-t6",
            speaker: "Pr\xE1tico",
            role: "character",
            style: "Voz alegre e acolhedora junto \xE0 lareira acesa",
            text: "Aqui dentro o vento n\xE3o entra! Aprendemos juntos que o que vale a pena fazer, vale a pena construir bem-feito.",
            pauseAfterMs: 300
          }
        ]
      },
      {
        id: "perrault-gato-de-botas",
        bookId: "contos-grimm-perrault",
        number: 3,
        roman: "III",
        numberLabel: "Conto III",
        title: "O Gato de Botas",
        estimatedMinutes: 2,
        wordCount: 215,
        characterCount: 3,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: "A intelig\xEAncia, a criatividade e a presen\xE7a de esp\xEDrito valem mais do que a maior das heran\xE7as.",
        aiNotes: "Roteiro pr\xE9-ajustado por IA \xB7 Interpreta\xE7\xE3o galante e aventureira para o Gato de Botas (Puck)",
        summary: "O filho mais novo de um moleiro herda apenas um gato \u2014 mas logo descobre que seu amigo felino, cal\xE7ado com um par de botas, tem planos dignos de um marqu\xEAs.",
        characters: [
          {
            name: "Contador de Hist\xF3rias",
            role: "narrator",
            description: "Narrador espirituoso dos contos de Perrault.",
            defaultVoice: "Charon",
            defaultStyle: "Narrador cl\xE1ssico elegante e bem-humorado"
          },
          {
            name: "O Gato de Botas",
            role: "character",
            description: "Felino astuto, eloquente e cheio de rever\xEAncias corteses.",
            defaultVoice: "Puck",
            defaultStyle: "Voz vivaz, confiante, galante e teatral em portugu\xEAs brasileiro"
          },
          {
            name: "O Rei",
            role: "character",
            description: "Monarca bonach\xE3o encantado com as gentilezas do Marqu\xEAs de Carab\xE1s.",
            defaultVoice: "Fenrir",
            defaultStyle: "Voz r\xE9gia, calorosa e impressionada"
          }
        ],
        turns: [
          {
            id: "pgb-t1",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Tom de f\xE1bula cavalheiresca",
            text: "Quando o velho moleiro partiu, deixou o moinho ao filho mais velho, o burrinho ao do meio e, ao ca\xE7ula, apenas um gato. Enquanto o rapaz suspirava sem saber o que fazer, o gato ergueu-se sobre as patas traseiras.",
            pauseAfterMs: 300
          },
          {
            id: "pgb-t2",
            speaker: "O Gato de Botas",
            role: "character",
            style: "Tom confiante, cavalheiresco e cheio de iniciativa",
            text: "N\xE3o fique triste, meu amo! D\xEA-me apenas um saco de pano e um par de botas de couro para caminhar pelos espinhos, e ver\xE1 que sua heran\xE7a \xE9 a mais valiosa das tr\xEAs!",
            pauseAfterMs: 320
          },
          {
            id: "pgb-t3",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Narrativa \xE1gil descrevendo as fa\xE7anhas do gato na corte",
            text: "Cal\xE7ando suas botas novas, o gato levou presentes da floresta ao pal\xE1cio real sempre em nome de seu amo, a quem batizou de Marqu\xEAs de Carab\xE1s. No dia em que a carruagem real passou pela estrada, o gato anunciou com uma profunda rever\xEAncia:",
            pauseAfterMs: 300
          },
          {
            id: "pgb-t4",
            speaker: "O Gato de Botas",
            role: "character",
            style: "Voz solene e cerimoniosa diante da carruagem real",
            text: "Sejam bem-vindos, Vossa Majestade e Alteza Real, \xE0s terras e ao castelo do nobre Marqu\xEAs de Carab\xE1s!",
            pauseAfterMs: 280
          },
          {
            id: "pgb-t5",
            speaker: "O Rei",
            role: "character",
            style: "Voz encantada e hospitaleira",
            text: "Que magn\xEDfico dom\xEDnio, jovem Marqu\xEAs! Um rapaz que conta com um conselheiro t\xE3o engenhoso merece sentar-se \xE0 nossa mesa real.",
            pauseAfterMs: 300
          }
        ]
      },
      {
        id: "grimm-joao-pe-feijao",
        bookId: "contos-grimm-perrault",
        number: 4,
        roman: "IV",
        numberLabel: "Conto IV",
        title: "Jo\xE3o e o P\xE9 de Feij\xE3o",
        estimatedMinutes: 3,
        wordCount: 220,
        characterCount: 4,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: "A coragem de subir al\xE9m das nuvens transforma sementes simples em grandes conquistas.",
        aiNotes: "Roteiro pr\xE9-ajustado por IA \xB7 Ambienta\xE7\xE3o de aventura m\xE1gica com a harpa dourada e o Gigante das nuvens",
        summary: "Cinco feij\xF5es m\xE1gicos plantados no quintal crescem durante a noite at\xE9 tocar um castelo escondido acima das nuvens.",
        characters: [
          {
            name: "Contador de Hist\xF3rias",
            role: "narrator",
            description: "Narrador de aventuras fant\xE1sticas.",
            defaultVoice: "Charon",
            defaultStyle: "Narrador cheio de encantamento e mist\xE9rio"
          },
          {
            name: "Jo\xE3o",
            role: "character",
            description: "Menino sonhador e destemido.",
            defaultVoice: "Puck",
            defaultStyle: "Voz jovem, curiosa e corajosa em portugu\xEAs brasileiro"
          },
          {
            name: "A Harpa Dourada",
            role: "character",
            description: "Instrumento m\xE1gico que canta sozinho no castelo das nuvens.",
            defaultVoice: "Zephyr",
            defaultStyle: "Voz cristalina, mel\xF3dica e encantada"
          },
          {
            name: "O Gigante das Nuvens",
            role: "character",
            description: "Guardi\xE3o ruidoso do castelo celeste.",
            defaultVoice: "Fenrir",
            defaultStyle: "Voz muito grave, lenta e retumbante"
          }
        ],
        turns: [
          {
            id: "gjpf-t1",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Tom m\xE1gico descrevendo o amanhecer extraordin\xE1rio",
            text: "Na manh\xE3 seguinte ao dia em que os feij\xF5es coloridos ca\xEDram na terra do jardim, Jo\xE3o abriu a janela do quarto e viu ramos verdes e grossos como troncos entrela\xE7ados que subiam at\xE9 sumir nas nuvens brancas.",
            pauseAfterMs: 320
          },
          {
            id: "gjpf-t2",
            speaker: "Jo\xE3o",
            role: "character",
            style: "Voz maravilhada olhando para o alto",
            text: "Os feij\xF5es do velhinho eram m\xE1gicos de verdade! Vou subir folha por folha para descobrir o que existe l\xE1 em cima no c\xE9u!",
            pauseAfterMs: 300
          },
          {
            id: "gjpf-t3",
            speaker: "O Gigante das Nuvens",
            role: "character",
            style: "Passos pesados e voz trovejante no sal\xE3o de pedra",
            text: "Fi-fo-fum! Sinto cheiro de menino curioso no meu sal\xE3o das nuvens! Quem ousa despertar o meu descanso?",
            pauseAfterMs: 280
          },
          {
            id: "gjpf-t4",
            speaker: "A Harpa Dourada",
            role: "character",
            style: "Tom musical e cristalino",
            text: "Corra, pequeno Jo\xE3o! Leve-me de volta ao vale, onde minha m\xFAsica poder\xE1 alegrar sua m\xE3e e fazer florescer o jardim inteiro!",
            pauseAfterMs: 300
          },
          {
            id: "gjpf-t5",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Desfecho luminoso e seguro no quintal de casa",
            text: "Deslizando pelo caule verde com a Harpa Dourada e a galinha m\xE1gica, Jo\xE3o chegou s\xE3o e salvo ao quintal, e nunca mais faltou m\xFAsica nem p\xE3o fresco em sua casa.",
            pauseAfterMs: 320
          }
        ]
      },
      {
        id: "grimm-musicos-bremen",
        bookId: "contos-grimm-perrault",
        number: 5,
        roman: "V",
        numberLabel: "Conto V",
        title: "Os M\xFAsicos de Bremen",
        estimatedMinutes: 2,
        wordCount: 205,
        characterCount: 4,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: "A amizade e a uni\xE3o de talentos diferentes criam uma harmonia que vence qualquer obst\xE1culo.",
        aiNotes: "Roteiro pr\xE9-ajustado por IA \xB7 Quarteto vocal alegre dos animais viajantes rumo a Bremen",
        summary: "Um Burro, um C\xE3o, uma Gata e um Galo juntam suas vozes na estrada para formar uma banda musical e encontram um novo lar.",
        characters: [
          {
            name: "Contador de Hist\xF3rias",
            role: "narrator",
            description: "Narrador afetuoso dos Irm\xE3os Grimm.",
            defaultVoice: "Charon",
            defaultStyle: "Narrador simp\xE1tico e acolhedor em portugu\xEAs brasileiro"
          },
          {
            name: "O Burro",
            role: "character",
            description: "L\xEDder otimista da caravana musical.",
            defaultVoice: "Fenrir",
            defaultStyle: "Voz grave, bondosa e encorajadora"
          },
          {
            name: "A Gata e o C\xE3o",
            role: "character",
            description: "Companheiros leais de estrada.",
            defaultVoice: "Kore",
            defaultStyle: "Voz calorosa e entusiasmada com a nova jornada"
          },
          {
            name: "O Galo",
            role: "character",
            description: "Cantor da madrugada com voz de tenor.",
            defaultVoice: "Puck",
            defaultStyle: "Voz vibrante, alegre e musical"
          }
        ],
        turns: [
          {
            id: "gmb-t1",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Tom de jornada alegre pela estrada rural",
            text: "Cansado de carregar sacos pesados no moinho, um bom Burro decidiu pegar a estrada rumo \xE0 cidade de Bremen para tornar-se m\xFAsico municipal. Pelo caminho, encontrou um C\xE3o ofegante, uma Gata pensativa e um Galo cantador.",
            pauseAfterMs: 320
          },
          {
            id: "gmb-t2",
            speaker: "O Burro",
            role: "character",
            style: "Convite caloroso e animado",
            text: "Venham comigo para Bremen, amigos! Eu tocarei o ala\xFAde, o C\xE3o bater\xE1 o tambor, a Gata far\xE1 a serenata e o Galo dar\xE1 as notas mais altas do nosso coro!",
            pauseAfterMs: 300
          },
          {
            id: "gmb-t3",
            speaker: "A Gata e o C\xE3o",
            role: "character",
            style: "Voz animada e esperan\xE7osa ao cair da noite",
            text: "Vejam, h\xE1 uma luz acesa naquela cabana no meio da mata! Vamos cantar nossa primeira can\xE7\xE3o diante da janela!",
            pauseAfterMs: 280
          },
          {
            id: "gmb-t4",
            speaker: "O Galo",
            role: "character",
            style: "Voz vibrante anunciando a cantoria em conjunto",
            text: "Um, dois, tr\xEAs e j\xE1: zurro, latido, miado e cocoric\xF3 na mesma melodia!",
            pauseAfterMs: 300
          },
          {
            id: "gmb-t5",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Desfecho bem-humorado e aconchegante",
            text: "O concerto noturno foi t\xE3o estrondoso que espantou os ladr\xF5es que ocupavam a cabana, e os quatro amigos passaram a viver ali juntos, cantando todas as noites ao redor da lareira.",
            pauseAfterMs: 320
          }
        ]
      }
    ]
  },
  {
    id: "contos-andersen",
    title: "Contos de Hans Christian Andersen",
    author: "Hans Christian Andersen",
    year: 1843,
    publicDomainSource: "Dom\xEDnio P\xFAblico \xB7 Contos N\xF3rdicos Ilustrados",
    coverUrl: "/src/assets/images/cover_contos_andersen_1795135333550.jpg",
    synopsis: "Hist\xF3rias po\xE9ticas e sens\xEDveis sobre descoberta, autenticidade e imagina\xE7\xE3o, pr\xE9-ajustadas por IA com dire\xE7\xE3o vocal l\xEDrica em portugu\xEAs.",
    chapters: [
      {
        id: "andersen-patinho-feio",
        bookId: "contos-andersen",
        number: 1,
        roman: "I",
        numberLabel: "Conto I",
        title: "O Patinho Feio",
        estimatedMinutes: 3,
        wordCount: 225,
        characterCount: 4,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: "Nossa verdadeira natureza floresce no tempo certo, quando reconhecemos quem realmente somos.",
        aiNotes: "Roteiro pr\xE9-ajustado por IA \xB7 Interpreta\xE7\xE3o l\xEDrica da transforma\xE7\xE3o do Patinho (Puck) junto aos Cisnes (Zephyr)",
        summary: "Nascido diferente da ninhada \xE0 beira do lago, um pequeno filhote atravessa as esta\xE7\xF5es at\xE9 ver seu verdadeiro reflexo nas \xE1guas claras da primavera.",
        characters: [
          {
            name: "Contador de Hist\xF3rias",
            role: "narrator",
            description: "Narrador po\xE9tico e sens\xEDvel dos contos de Andersen.",
            defaultVoice: "Charon",
            defaultStyle: "Narrador brasileiro l\xEDrico, terno e contemplativo"
          },
          {
            name: "M\xE3e Pata",
            role: "character",
            description: "Afetuosa e protetora com seu filhote diferente.",
            defaultVoice: "Kore",
            defaultStyle: "Voz materna, carinhosa e acolhedora"
          },
          {
            name: "O Jovem Patinho",
            role: "character",
            description: "Sens\xEDvel, t\xEDmido no in\xEDcio e deslumbrado ao final.",
            defaultVoice: "Puck",
            defaultStyle: "Voz jovem, delicada e depois radiante de surpresa"
          },
          {
            name: "O Cisne Real",
            role: "character",
            description: "Ave majestosa do lago da primavera.",
            defaultVoice: "Zephyr",
            defaultStyle: "Voz serena, luminosa e acolhedora"
          }
        ],
        turns: [
          {
            id: "apf-t1",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Tom po\xE9tico descrevendo o ver\xE3o \xE0 beira do canal",
            text: "Fazia sol no campo quando os ovos da M\xE3e Pata se abriram um a um. Por \xFAltimo, do maior ovo do ninho, saiu um filhote grande, de penas acinzentadas, muito diferente de seus irm\xE3ozinhos amarelos.",
            pauseAfterMs: 320
          },
          {
            id: "apf-t2",
            speaker: "M\xE3e Pata",
            role: "character",
            style: "Tom terno e encorajador olhando o filhote nadar",
            text: "Vejam como ele nada com eleg\xE2ncia e mant\xE9m o pesco\xE7o erguido! Ele tem bom cora\xE7\xE3o e logo encontrar\xE1 o seu lugar no mundo.",
            pauseAfterMs: 300
          },
          {
            id: "apf-t3",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Passagem l\xEDrica do outono e do inverno at\xE9 a chegada da primavera",
            text: "Cansado das zombarias no quintal, o pequeno partiu pelo p\xE2ntano, enfrentou o vento frio do outono e o gelo do inverno. Mas quando as macieiras floresceram na primavera, tr\xEAs aves brancas e majestosas pousaram no espelho do lago.",
            pauseAfterMs: 340
          },
          {
            id: "apf-t4",
            speaker: "O Jovem Patinho",
            role: "character",
            style: "Sussurro de encantamento ao olhar na \xE1gua cristalina",
            text: "Vou nadar at\xE9 essas aves reais... Mas esperem! Quem \xE9 este refletido na \xE1gua clara, com penas brancas como a neve e pesco\xE7o curvo?",
            pauseAfterMs: 280
          },
          {
            id: "apf-t5",
            speaker: "O Cisne Real",
            role: "character",
            style: "Boas-vindas suaves e luminosas",
            text: "Bem-vindo \xE0 sua fam\xEDlia, irm\xE3o! Voc\xEA nunca foi um patinho desajeitado: sempre foi um cisne esperando a primavera para abrir as asas.",
            pauseAfterMs: 320
          }
        ]
      },
      {
        id: "andersen-roupa-imperador",
        bookId: "contos-andersen",
        number: 2,
        roman: "II",
        numberLabel: "Conto II",
        title: "A Roupa Nova do Imperador",
        estimatedMinutes: 3,
        wordCount: 228,
        characterCount: 4,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: "A sinceridade de um olhar puro vale mais do que uma corte inteira com medo de dizer a verdade.",
        aiNotes: "Roteiro pr\xE9-ajustado por IA \xB7 Humor fino entre o Tecel\xE3o Astuto (Zephyr), o Imperador (Fenrir) e a Crian\xE7a (Puck)",
        summary: "Dois falsos tecel\xF5es prometem ao vaidoso Imperador um tecido m\xE1gico que seria invis\xEDvel para quem n\xE3o soubesse cumprir seu cargo.",
        characters: [
          {
            name: "Contador de Hist\xF3rias",
            role: "narrator",
            description: "Narrador espirituoso e observador.",
            defaultVoice: "Charon",
            defaultStyle: "Narrador bem-humorado e elegante em portugu\xEAs brasileiro"
          },
          {
            name: "O Tecel\xE3o Astuto",
            role: "character",
            description: "Falso alfaiate que tece fios imagin\xE1rios.",
            defaultVoice: "Zephyr",
            defaultStyle: "Voz persuasiva, teatral e cheia de mist\xE9rio"
          },
          {
            name: "O Imperador",
            role: "character",
            description: "Monarca apaixonado por mantos luxuosos e desfiles.",
            defaultVoice: "Fenrir",
            defaultStyle: "Voz pomposa, tentando disfar\xE7ar o espanto"
          },
          {
            name: "A Crian\xE7a na Pra\xE7a",
            role: "character",
            description: "Voz espont\xE2nea e sincera no meio do desfile.",
            defaultVoice: "Puck",
            defaultStyle: "Voz infantil clara, alegre e verdadeira"
          }
        ],
        turns: [
          {
            id: "ari-t1",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Tom alegre apresentando a corte vaidosa",
            text: "H\xE1 muitos anos vivia um Imperador que gostava tanto de trajes novos que trocava de manto a cada hora do dia. Sabendo disso, dois forasteiros espertos apresentaram-se no pal\xE1cio dizendo-se tecel\xF5es de um pano \xFAnico no mundo.",
            pauseAfterMs: 320
          },
          {
            id: "ari-t2",
            speaker: "O Tecel\xE3o Astuto",
            role: "character",
            style: "Tom cerimonioso apontando para o tear completamente vazio",
            text: "Vossa Majestade, este tecido n\xE3o apenas possui cores extraordin\xE1rias, como tem o dom m\xE1gico de ficar invis\xEDvel para qualquer pessoa que n\xE3o seja s\xE1bia em seu of\xEDcio!",
            pauseAfterMs: 300
          },
          {
            id: "ari-t3",
            speaker: "O Imperador",
            role: "character",
            style: "Sussurrando preocupado consigo mesmo e depois falando alto com pompa",
            text: "C\xE9us, n\xE3o estou vendo fio algum no tear! Mas ningu\xE9m pode desconfiar de mim... Magn\xEDfico! Os bordados dourados e o manto real est\xE3o simplesmente espl\xEAndidos!",
            pauseAfterMs: 320
          },
          {
            id: "ari-t4",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Descrevendo o cortejo solene pelas ruas da capital",
            text: "No dia da grande prociss\xE3o, o Imperador caminhou sob o p\xE1lio real enquanto os camareiros seguravam no ar uma cauda inexistente. Todos na rua aplaudiam com receio de parecer tolos, at\xE9 que uma crian\xE7a ergueu a voz na pra\xE7a:",
            pauseAfterMs: 280
          },
          {
            id: "ari-t5",
            speaker: "A Crian\xE7a na Pra\xE7a",
            role: "character",
            style: "Voz infantil clara, risonha e espont\xE2nea",
            text: "Olhem s\xF3, papai! O Imperador n\xE3o est\xE1 vestindo manto nenhum, ele saiu de pijama real!",
            pauseAfterMs: 300
          }
        ]
      },
      {
        id: "andersen-soldadinho-chumbo",
        bookId: "contos-andersen",
        number: 3,
        roman: "III",
        numberLabel: "Conto III",
        title: "O Soldadinho de Chumbo",
        estimatedMinutes: 2,
        wordCount: 195,
        characterCount: 3,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: "A firmeza de car\xE1ter e a lealdade do cora\xE7\xE3o permanecem inteiras mesmo nas maiores travessias.",
        aiNotes: "Roteiro pr\xE9-ajustado por IA \xB7 Atmosfera delicada do quarto de brinquedos \xE0 meia-noite",
        summary: "Fundido com a \xFAltima colher de estanho, um pequeno soldado de uma perna s\xF3 vive uma grande jornada num barquinho de papel antes de voltar ao castelo da Bailarina.",
        characters: [
          {
            name: "Contador de Hist\xF3rias",
            role: "narrator",
            description: "Narrador afetuoso de Andersen.",
            defaultVoice: "Charon",
            defaultStyle: "Narrador delicado, po\xE9tico e aventureiro"
          },
          {
            name: "O Menino",
            role: "character",
            description: "Dono da caixa de brinquedos de anivers\xE1rio.",
            defaultVoice: "Puck",
            defaultStyle: "Voz infantil entusiasmada e carinhosa"
          },
          {
            name: "A Bailarina de Papel",
            role: "character",
            description: "Graciosa dan\xE7arina do castelo de cart\xE3o com uma lantejoula azul.",
            defaultVoice: "Zephyr",
            defaultStyle: "Voz suave, cristalina e encantada"
          }
        ],
        turns: [
          {
            id: "asc-t1",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Tom \xEDntimo e m\xE1gico no quarto de brinquedos",
            text: "Eram vinte e cinco soldadinhos de chumbo, todos irm\xE3os nascidos da mesma colher de metal. O \xFAltimo, fundido quando o estanho j\xE1 acabava, tinha apenas uma perna, mas mantinha-se firme como nenhum outro diante do castelo de papel\xE3o.",
            pauseAfterMs: 320
          },
          {
            id: "asc-t2",
            speaker: "O Menino",
            role: "character",
            style: "Voz admirada arrumando os brinquedos na mesa",
            text: "Este aqui \xE9 o mais valente do batalh\xE3o! Ele vai ficar de guarda bem em frente \xE0 porta do castelo da pequena Bailarina!",
            pauseAfterMs: 280
          },
          {
            id: "asc-t3",
            speaker: "A Bailarina de Papel",
            role: "character",
            style: "Sussurro doce quando o rel\xF3gio bate meia-noite",
            text: "Boa noite, valente soldadinho. Eu tamb\xE9m me equilibro numa ponta s\xF3, com minha faixa azul e minha estrela brilhante.",
            pauseAfterMs: 320
          },
          {
            id: "asc-t4",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Narrando a aventura no barquinho de jornal e o retorno feliz",
            text: "Levado por uma rajada de vento na janela, o Soldadinho navegou num barco de jornal pelas enxurradas da rua e atravessou o canal at\xE9 ser resgatado e trazido de volta \xE0 mesma mesa da sala, onde a Bailarina ainda o esperava em perfeito equil\xEDbrio.",
            pauseAfterMs: 300
          }
        ]
      },
      {
        id: "andersen-princesa-ervilha",
        bookId: "contos-andersen",
        number: 4,
        roman: "IV",
        numberLabel: "Conto IV",
        title: "A Princesa e a Ervilha",
        estimatedMinutes: 2,
        wordCount: 190,
        characterCount: 4,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: "A verdadeira delicadeza e sensibilidade revelam-se nos menores detalhes, n\xE3o nas apar\xEAncias.",
        aiNotes: "Roteiro pr\xE9-ajustado por IA \xB7 Di\xE1logo bem-humorado na manh\xE3 seguinte \xE0 tempestade real",
        summary: "Numa noite de tempestade, uma jovem bate aos port\xF5es do castelo dizendo ser uma princesa verdadeira \u2014 e a Rainha prepara um teste secreto sob vinte colch\xF5es.",
        characters: [
          {
            name: "Contador de Hist\xF3rias",
            role: "narrator",
            description: "Narrador bem-humorado do conto real.",
            defaultVoice: "Charon",
            defaultStyle: "Narrador cl\xE1ssico com leve toque de humor"
          },
          {
            name: "A Rainha",
            role: "character",
            description: "S\xE1bia soberana que conhece os segredos da corte.",
            defaultVoice: "Kore",
            defaultStyle: "Voz r\xE9gia, perspicaz e gentil"
          },
          {
            name: "A Princesa Viajante",
            role: "character",
            description: "Jovem delicada e educada que chega sob a chuva.",
            defaultVoice: "Zephyr",
            defaultStyle: "Voz doce, cort\xEAs e sincera"
          },
          {
            name: "O Pr\xEDncipe",
            role: "character",
            description: "Jovem herdeiro que procurava uma princesa aut\xEAntica.",
            defaultVoice: "Puck",
            defaultStyle: "Voz jovem, alegre e encantada"
          }
        ],
        turns: [
          {
            id: "ape-t1",
            speaker: "Contador de Hist\xF3rias",
            role: "narrator",
            style: "Tom de conto cl\xE1ssico numa noite chuvosa",
            text: "Era uma vez um Pr\xEDncipe que viajou pelo mundo inteiro em busca de uma princesa verdadeira, mas voltara ao castelo sem ter certeza. Certa noite de chuva e trov\xF5es, algu\xE9m bateu ao grande port\xE3o.",
            pauseAfterMs: 300
          },
          {
            id: "ape-t2",
            speaker: "A Rainha",
            role: "character",
            style: "Tom confidencial e engenhoso preparando o quarto de h\xF3spedes",
            text: "Ela diz ser uma princesa de verdade, mesmo com os cabelos molhados da chuva. N\xE3o direi nada: colocarei um pequeno gr\xE3o de ervilha no estrado da cama e empilharei vinte colch\xF5es macios e vinte edredons por cima.",
            pauseAfterMs: 320
          },
          {
            id: "ape-t3",
            speaker: "A Princesa Viajante",
            role: "character",
            style: "Tom educado mas cansado na manh\xE3 seguinte",
            text: "Agrade\xE7o imensamente a hospitalidade de Vossas Majestades, mas mal consegui pregar os olhos a noite inteira. Havia algo t\xE3o duro debaixo do colch\xE3o que acordei toda dolorida!",
            pauseAfterMs: 280
          },
          {
            id: "ape-t4",
            speaker: "O Pr\xEDncipe",
            role: "character",
            style: "Voz radiante de alegria",
            text: "Sentir uma \xFAnica ervilha atrav\xE9s de vinte colch\xF5es e vinte edredons? S\xF3 uma verdadeira princesa teria tamanha sensibilidade!",
            pauseAfterMs: 300
          }
        ]
      }
    ]
  }
];

// server/bookLibrary.ts
var BUNDLED_BOOKS_DIR = path2.resolve(process.cwd(), "data", "books");
var BUNDLED_SCRIPT_CACHE_DIR = path2.resolve(process.cwd(), "data", "script-cache");
var IS_SERVERLESS2 = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
var WRITABLE_BOOKS_DIR = IS_SERVERLESS2 ? path2.join(os2.tmpdir(), "voz-e-folha", "books") : BUNDLED_BOOKS_DIR;
var WRITABLE_SCRIPT_CACHE_DIR = IS_SERVERLESS2 ? path2.join(os2.tmpdir(), "voz-e-folha", "script-cache") : BUNDLED_SCRIPT_CACHE_DIR;
var BUILT_IN_BOOK_IDS = /* @__PURE__ */ new Set([
  "fabulas-esopo",
  "contos-grimm-perrault",
  "contos-andersen"
]);
var cachedFullBooks = null;
function ensureDir(dir) {
  try {
    if (!fs2.existsSync(dir)) {
      fs2.mkdirSync(dir, { recursive: true });
    }
  } catch {
  }
}
function sanitizeId(id) {
  if (!/^[a-zA-Z0-9_-]{2,80}$/.test(id)) {
    throw new Error("Identificador inv\xE1lido.");
  }
  return id;
}
function invalidateBookLibraryCache() {
  cachedFullBooks = null;
}
function readCachedDramatizedScript(chapterId) {
  try {
    const safe = sanitizeId(chapterId);
    const writablePath = path2.join(WRITABLE_SCRIPT_CACHE_DIR, `${safe}.json`);
    if (fs2.existsSync(writablePath)) {
      return JSON.parse(fs2.readFileSync(writablePath, "utf-8"));
    }
    const bundledPath = path2.join(BUNDLED_SCRIPT_CACHE_DIR, `${safe}.json`);
    if (fs2.existsSync(bundledPath)) {
      return JSON.parse(fs2.readFileSync(bundledPath, "utf-8"));
    }
    return null;
  } catch {
    return null;
  }
}
function writeCachedDramatizedScript(chapterId, payload) {
  ensureDir(WRITABLE_SCRIPT_CACHE_DIR);
  const safeId = sanitizeId(chapterId);
  const filePath = path2.join(WRITABLE_SCRIPT_CACHE_DIR, `${safeId}.json`);
  const tmpPath = `${filePath}.tmp`;
  const record = {
    chapterId: safeId,
    summary: payload.summary,
    moral: payload.moral,
    aiNotes: payload.aiNotes || `Roteiro pr\xE9-ajustado por IA \xB7 ${payload.characters.length} vozes calibradas para f\xE1bula/conto infantil`,
    characters: payload.characters,
    turns: payload.turns,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  fs2.writeFileSync(tmpPath, JSON.stringify(record, null, 2), "utf-8");
  fs2.renameSync(tmpPath, filePath);
  return record;
}
function applyScriptOverlay(chapter) {
  const overlay = readCachedDramatizedScript(chapter.id);
  if (!overlay) return chapter;
  return {
    ...chapter,
    summary: overlay.summary || chapter.summary,
    moral: overlay.moral || chapter.moral,
    aiNotes: overlay.aiNotes || chapter.aiNotes,
    characters: overlay.characters,
    turns: overlay.turns,
    characterCount: overlay.characters.length,
    dramatizedByAi: true
  };
}
function readBookJsonFile(filePath) {
  try {
    if (!fs2.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs2.readFileSync(filePath, "utf-8"));
    if (Array.isArray(parsed.chapters) && parsed.chapters.length > 0) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.error(`Erro ao ler ${filePath}:`, err);
    return null;
  }
}
function loadFullBooks() {
  if (cachedFullBooks) {
    return cachedFullBooks;
  }
  ensureDir(WRITABLE_BOOKS_DIR);
  const candidateDirs = WRITABLE_BOOKS_DIR === BUNDLED_BOOKS_DIR ? [BUNDLED_BOOKS_DIR] : [WRITABLE_BOOKS_DIR, BUNDLED_BOOKS_DIR];
  const books = PUBLIC_DOMAIN_BOOKS.map((seedBook) => {
    for (const dir of candidateDirs) {
      const fullFile = readBookJsonFile(path2.join(dir, `${seedBook.id}.json`));
      if (fullFile?.chapters && fullFile.chapters.length > 0) {
        return {
          ...seedBook,
          publicDomainSource: fullFile.publicDomainSource || seedBook.publicDomainSource,
          gutenbergId: fullFile.gutenbergId ?? seedBook.gutenbergId,
          chapters: fullFile.chapters
        };
      }
    }
    return seedBook;
  });
  const knownIds = new Set(books.map((b) => b.id));
  const extraBooks = [];
  for (const dir of candidateDirs) {
    if (!fs2.existsSync(dir)) continue;
    const files = fs2.readdirSync(dir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const slug = file.replace(/\.json$/, "");
      if (knownIds.has(slug)) continue;
      const parsed = readBookJsonFile(path2.join(dir, file));
      if (!parsed || !parsed.id || !parsed.title || !parsed.chapters) continue;
      extraBooks.push({
        id: parsed.id,
        title: parsed.title,
        author: parsed.author || "Tradi\xE7\xE3o Popular",
        year: typeof parsed.year === "number" ? parsed.year : (/* @__PURE__ */ new Date()).getFullYear(),
        publicDomainSource: parsed.publicDomainSource || "Conto adicionado \xE0 biblioteca",
        coverUrl: parsed.coverUrl || "",
        synopsis: parsed.synopsis || "",
        gutenbergId: parsed.gutenbergId,
        isCustom: parsed.isCustom ?? true,
        chapters: parsed.chapters
      });
      knownIds.add(parsed.id);
    }
  }
  extraBooks.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  cachedFullBooks = [...books, ...extraBooks];
  return cachedFullBooks;
}
function saveBookToLibrary(book) {
  ensureDir(WRITABLE_BOOKS_DIR);
  const safeId = sanitizeId(book.id);
  const normalized = { ...book, id: safeId };
  const filePath = path2.join(WRITABLE_BOOKS_DIR, `${safeId}.json`);
  const tmpPath = `${filePath}.tmp`;
  fs2.writeFileSync(tmpPath, JSON.stringify(normalized, null, 2), "utf-8");
  fs2.renameSync(tmpPath, filePath);
  invalidateBookLibraryCache();
  return normalized;
}
function deleteCustomBook(bookId) {
  const safeId = sanitizeId(bookId);
  if (BUILT_IN_BOOK_IDS.has(safeId)) {
    throw new Error("As cole\xE7\xF5es principais de f\xE1bulas e contos n\xE3o podem ser removidas.");
  }
  const filePath = path2.join(WRITABLE_BOOKS_DIR, `${safeId}.json`);
  if (!fs2.existsSync(filePath)) return false;
  fs2.unlinkSync(filePath);
  invalidateBookLibraryCache();
  return true;
}
function getInstalledBookIds() {
  return new Set(loadFullBooks().map((b) => b.id));
}
function getInstalledGutenbergIds() {
  const set = /* @__PURE__ */ new Set();
  for (const book of loadFullBooks()) {
    if (typeof book.gutenbergId === "number") {
      set.add(book.gutenbergId);
    }
  }
  return set;
}
function toChapterSummary(chapter) {
  return {
    id: chapter.id,
    bookId: chapter.bookId,
    number: chapter.number,
    roman: chapter.roman,
    numberLabel: chapter.numberLabel,
    title: chapter.title,
    estimatedMinutes: chapter.estimatedMinutes,
    wordCount: chapter.wordCount,
    characterCount: chapter.characterCount,
    hasDialogue: chapter.hasDialogue,
    dramatizedByAi: chapter.dramatizedByAi,
    moral: chapter.moral,
    aiNotes: chapter.aiNotes,
    isCustom: chapter.isCustom
  };
}
function toBookCatalogItem(book) {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    year: book.year,
    publicDomainSource: book.publicDomainSource,
    coverUrl: book.coverUrl,
    synopsis: book.synopsis,
    gutenbergId: book.gutenbergId,
    isCustom: book.isCustom,
    chapters: book.chapters.map((ch) => toChapterSummary(applyScriptOverlay(ch)))
  };
}
function getBookCatalog() {
  return loadFullBooks().map(toBookCatalogItem);
}
function getChapterById(bookId, chapterId) {
  const books = loadFullBooks();
  const book = books.find((b) => b.id === bookId) ?? books.find((b) => b.chapters.some((c) => c.id === chapterId));
  if (!book) return null;
  const raw = book.chapters.find((c) => c.id === chapterId);
  if (!raw) return null;
  return {
    book,
    chapter: applyScriptOverlay(raw)
  };
}

// server/gemini.ts
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

// src/lib/wav.ts
function readAscii(bytes, offset, length) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += String.fromCharCode(bytes[offset + i]);
  }
  return out;
}
function readUint32LE(bytes, offset) {
  return (bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16 | bytes[offset + 3] << 24) >>> 0;
}
function readUint16LE(bytes, offset) {
  return (bytes[offset] | bytes[offset + 1] << 8) >>> 0;
}
function writeAscii(target, offset, text) {
  for (let i = 0; i < text.length; i++) {
    target[offset + i] = text.charCodeAt(i);
  }
}
function writeUint32LE(target, offset, value) {
  target[offset] = value & 255;
  target[offset + 1] = value >>> 8 & 255;
  target[offset + 2] = value >>> 16 & 255;
  target[offset + 3] = value >>> 24 & 255;
}
function writeUint16LE(target, offset, value) {
  target[offset] = value & 255;
  target[offset + 1] = value >>> 8 & 255;
}
function parseWavBuffer(bytes) {
  if (bytes.length < 44) {
    throw new Error("Buffer WAV inv\xE1lido: menor que o cabe\xE7alho m\xEDnimo de 44 bytes.");
  }
  const riff = readAscii(bytes, 0, 4);
  const wave = readAscii(bytes, 8, 4);
  if (riff !== "RIFF" || wave !== "WAVE") {
    throw new Error(`Formato inv\xE1lido: esperado RIFF/WAVE, recebido ${riff}/${wave}.`);
  }
  let sampleRate = 24e3;
  let numChannels = 1;
  let bitsPerSample = 16;
  let foundFmt = false;
  let pcmData = null;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkId = readAscii(bytes, offset, 4);
    const chunkSize = readUint32LE(bytes, offset + 4);
    const dataStart = offset + 8;
    const dataEnd = Math.min(dataStart + chunkSize, bytes.length);
    if (chunkId === "fmt " && dataEnd - dataStart >= 16) {
      numChannels = readUint16LE(bytes, dataStart + 2);
      sampleRate = readUint32LE(bytes, dataStart + 4);
      bitsPerSample = readUint16LE(bytes, dataStart + 14);
      foundFmt = true;
    } else if (chunkId === "data") {
      pcmData = bytes.slice(dataStart, dataEnd);
      break;
    }
    offset = dataStart + chunkSize + chunkSize % 2;
  }
  if (!foundFmt || !pcmData) {
    throw new Error("Buffer WAV incompleto: subchunks fmt ou data n\xE3o encontrados.");
  }
  const bytesPerSecond = sampleRate * numChannels * (bitsPerSample / 8);
  const durationSec = bytesPerSecond > 0 ? pcmData.length / bytesPerSecond : 0;
  return {
    sampleRate,
    numChannels,
    bitsPerSample,
    pcmData,
    durationSec
  };
}
function buildWavFromPcm(pcmData, sampleRate = 24e3, numChannels = 1, bitsPerSample = 16) {
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const headerSize = 44;
  const wav = new Uint8Array(headerSize + pcmData.length);
  writeAscii(wav, 0, "RIFF");
  writeUint32LE(wav, 4, 36 + pcmData.length);
  writeAscii(wav, 8, "WAVE");
  writeAscii(wav, 12, "fmt ");
  writeUint32LE(wav, 16, 16);
  writeUint16LE(wav, 20, 1);
  writeUint16LE(wav, 22, numChannels);
  writeUint32LE(wav, 24, sampleRate);
  writeUint32LE(wav, 28, byteRate);
  writeUint16LE(wav, 32, blockAlign);
  writeUint16LE(wav, 34, bitsPerSample);
  writeAscii(wav, 36, "data");
  writeUint32LE(wav, 40, pcmData.length);
  wav.set(pcmData, headerSize);
  return wav;
}
function createSilencePcm(durationMs, sampleRate = 24e3, numChannels = 1, bitsPerSample = 16) {
  if (durationMs <= 0) {
    return new Uint8Array(0);
  }
  const blockAlign = numChannels * (bitsPerSample / 8);
  const frameCount = Math.round(sampleRate * durationMs / 1e3);
  return new Uint8Array(frameCount * blockAlign);
}
function concatWavClips(clips) {
  if (clips.length === 0) {
    throw new Error("Nenhum clipe de \xE1udio fornecido para concatena\xE7\xE3o.");
  }
  const parsedClips = clips.map((clip) => ({
    id: clip.id,
    pauseAfterMs: clip.pauseAfterMs ?? 0,
    parsed: parseWavBuffer(clip.wavBuffer)
  }));
  const { sampleRate, numChannels, bitsPerSample } = parsedClips[0].parsed;
  const bytesPerSecond = sampleRate * numChannels * (bitsPerSample / 8);
  const chunks = [];
  const timings = [];
  let cursorBytes = 0;
  for (let i = 0; i < parsedClips.length; i++) {
    const item = parsedClips[i];
    if (item.parsed.sampleRate !== sampleRate || item.parsed.numChannels !== numChannels || item.parsed.bitsPerSample !== bitsPerSample) {
      throw new Error("Os clipes WAV possuem par\xE2metros de amostragem incompat\xEDveis.");
    }
    const startSec = cursorBytes / bytesPerSecond;
    chunks.push(item.parsed.pcmData);
    cursorBytes += item.parsed.pcmData.length;
    const endSec = cursorBytes / bytesPerSecond;
    timings.push({
      id: item.id,
      startSec: Number(startSec.toFixed(3)),
      endSec: Number(endSec.toFixed(3))
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
    timings
  };
}

// server/gemini.ts
var VALID_VOICES = ["Charon", "Kore", "Puck", "Fenrir", "Zephyr"];
function getGeminiClient(apiVersion) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error(
      "Chave da API Gemini n\xE3o configurada no servidor. Verifique as configura\xE7\xF5es de segredos do ambiente."
    );
  }
  return new GoogleGenAI({
    apiKey,
    ...apiVersion ? { apiVersion } : {},
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}
function formatGeminiError(error, fallback) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (!raw) return fallback;
  if (isDailyQuotaError(raw)) {
    return "Cota di\xE1ria da IA atingida para gera\xE7\xE3o de voz. Voc\xEA pode ouvir as f\xE1bulas j\xE1 pr\xE9-renderizadas em cache WAV ou usar a voz local do dispositivo.";
  }
  try {
    const parsed = JSON.parse(raw);
    const code = parsed.error?.code;
    const status = parsed.error?.status ?? "";
    const msg = parsed.error?.message ?? "";
    if (code === 403 || status === "PERMISSION_DENIED" || msg.includes("API_KEY_INVALID")) {
      return "Chave da API Gemini inv\xE1lida ou sem permiss\xE3o. Verifique o painel Settings > Secrets.";
    }
    if (code === 429 || status === "RESOURCE_EXHAUSTED") {
      return "Limite de requisi\xE7\xF5es por minuto atingido. As partes j\xE1 pr\xE9-renderizadas ficaram salvas \u2014 tente novamente em instantes ou ou\xE7a os contos j\xE1 em cache.";
    }
    if (msg) {
      return `${fallback} (${msg.slice(0, 160)})`;
    }
  } catch {
  }
  if (raw.includes("API_KEY_INVALID") || raw.includes("PERMISSION_DENIED")) {
    return "Chave da API Gemini inv\xE1lida ou sem permiss\xE3o. Verifique o painel Settings > Secrets.";
  }
  if (isRateLimitError(raw)) {
    return "Limite de requisi\xE7\xF5es atingido no momento. As partes j\xE1 geradas ficaram salvas \u2014 aguarde alguns instantes ou use a voz local.";
  }
  return raw.length > 220 ? `${raw.slice(0, 220)}\u2026` : raw;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function withRetry(fn, options) {
  const maxAttempts = options?.maxAttempts ?? 4;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      options?.pacer?.recordSuccess();
      return result;
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : String(error);
      if (isRateLimitError(msg)) {
        const parsedDelay = parseRetryDelayMs(msg);
        options?.pacer?.recordRateLimit(parsedDelay);
      }
      if (!isRetryableGeminiError(msg) || attempt === maxAttempts) {
        throw error;
      }
      const waitMs = computeBackoffDelayMs({
        attempt,
        errorText: msg,
        adaptivePacingMs: options?.pacer?.getSpacingMs()
      });
      options?.onWaitingRetry?.(Math.max(1, Math.ceil(waitMs / 1e3)));
      await sleep(waitMs);
    }
  }
  throw lastError;
}
async function synthesizeSingleVoiceLiteWav(ai, textParts, voiceName, options) {
  const response = await withRetry(
    () => ai.models.generateContent({
      model: "gemini-3.8-flash-lite-tts",
      contents: [
        {
          role: "user",
          parts: textParts
        }
      ],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    }),
    {
      maxAttempts: 4,
      pacer: options?.pacer,
      onWaitingRetry: options?.onWaitingRetry
    }
  );
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("O modelo de voz lite n\xE3o retornou dados de \xE1udio para este trecho.");
  }
  return new Uint8Array(Buffer.from(base64Audio, "base64"));
}
var primaryFlashTtsDailyQuotaExhausted = false;
async function synthesizeWithLiteFallback(ai, batch, options) {
  const isDualSpeaker = batch.speakers.length === 2;
  if (!isDualSpeaker) {
    const soloSpeaker = batch.speakers[0];
    return synthesizeSingleVoiceLiteWav(
      ai,
      batch.turns.map((item) => ({ text: item.turn.text })),
      soloSpeaker.voiceName,
      options
    );
  }
  const turnClips = [];
  for (let idx = 0; idx < batch.turns.length; idx++) {
    if (idx > 0) {
      const waitMs = options?.pacer ? options.pacer.getRequiredWaitMs(Date.now(), 2200) : 2200;
      if (waitMs > 0) {
        await sleep(waitMs);
      }
    }
    const item = batch.turns[idx];
    const wavBuffer = await synthesizeSingleVoiceLiteWav(
      ai,
      [{ text: item.turn.text }],
      item.voiceName,
      options
    );
    turnClips.push({
      id: item.turn.id,
      wavBuffer,
      pauseAfterMs: idx === batch.turns.length - 1 ? 0 : item.turn.pauseAfterMs ?? 240
    });
  }
  return concatWavClips(turnClips).wavBuffer;
}
async function synthesizeBatchWav(ai, batch, options) {
  if (primaryFlashTtsDailyQuotaExhausted) {
    return synthesizeWithLiteFallback(ai, batch, options);
  }
  const isDualSpeaker = batch.speakers.length === 2;
  try {
    const response = await withRetry(
      () => {
        if (isDualSpeaker) {
          return ai.models.generateContent({
            model: "gemini-3.8-flash-tts",
            contents: [
              {
                role: "user",
                parts: batch.turns.map((item) => ({
                  text: `${item.speakerLabel}: ${item.turn.text}`,
                  speechMetadata: {
                    speaker: item.speakerLabel,
                    style: `${item.turn.style}. Conta\xE7\xE3o de hist\xF3rias e f\xE1bulas infantis em portugu\xEAs do Brasil, expressiva e natural.`
                  }
                }))
              }
            ],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                multiSpeakerVoiceConfig: {
                  speakerVoiceConfigs: batch.speakers.map((sp) => ({
                    speaker: sp.label,
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: sp.voiceName }
                    }
                  }))
                }
              }
            }
          });
        }
        const soloSpeaker = batch.speakers[0];
        return ai.models.generateContent({
          model: "gemini-3.8-flash-tts",
          contents: [
            {
              role: "user",
              parts: batch.turns.map((item) => ({
                text: item.turn.text,
                speechMetadata: {
                  style: `${item.turn.style}. Conta\xE7\xE3o de hist\xF3rias e f\xE1bulas infantis em portugu\xEAs do Brasil, expressiva e natural.`
                }
              }))
            }
          ],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: soloSpeaker.voiceName }
              }
            }
          }
        });
      },
      {
        maxAttempts: 3,
        pacer: options?.pacer,
        onWaitingRetry: options?.onWaitingRetry
      }
    );
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("O modelo de voz n\xE3o retornou dados de \xE1udio para este trecho.");
    }
    return new Uint8Array(Buffer.from(base64Audio, "base64"));
  } catch (primaryError) {
    const msg = primaryError instanceof Error ? primaryError.message : String(primaryError);
    if (isDailyQuotaError(msg)) {
      primaryFlashTtsDailyQuotaExhausted = true;
    } else if (!isRateLimitError(msg)) {
      throw primaryError;
    }
    return synthesizeWithLiteFallback(ai, batch, options);
  }
}
async function synthesizeChapterAudio(params) {
  const ai = getGeminiClient("v1beta");
  const { turns, voiceMap, mode, cacheKey, forceRegenerate, pacer: pacer2, minSpacingMs, onProgress } = params;
  const narratorTurn = turns.find((t) => t.role === "narrator") ?? turns[0];
  const primaryNarratorVoice = narratorTurn && voiceMap[narratorTurn.speaker] || "Charon";
  const batches = batchTurnsForTts(turns, voiceMap, mode, primaryNarratorVoice);
  if (cacheKey && forceRegenerate) {
    clearPartialBatchCache(cacheKey);
  }
  const clipInputs = [];
  let reusedBatches = 0;
  onProgress?.({
    state: "synthesizing",
    completedBatches: 0,
    totalBatches: batches.length,
    reusedBatches: 0
  });
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const fingerprint = computeBatchFingerprint(batch);
    let wavBuffer = cacheKey && !forceRegenerate ? readPartialBatchWav(cacheKey, i, fingerprint) : null;
    if (wavBuffer) {
      reusedBatches += 1;
    } else {
      if (pacer2) {
        const requiredWait = pacer2.getRequiredWaitMs(Date.now(), minSpacingMs ?? 0);
        if (requiredWait > 0) {
          if (requiredWait >= 2500) {
            onProgress?.({
              state: "waiting_retry",
              completedBatches: i,
              totalBatches: batches.length,
              reusedBatches,
              waitingRetrySec: Math.ceil(requiredWait / 1e3)
            });
          }
          await sleep(requiredWait);
        }
      }
      onProgress?.({
        state: "synthesizing",
        completedBatches: i,
        totalBatches: batches.length,
        reusedBatches
      });
      wavBuffer = await synthesizeBatchWav(ai, batch, {
        pacer: pacer2,
        onWaitingRetry: (waitSec) => {
          onProgress?.({
            state: "waiting_retry",
            completedBatches: i,
            totalBatches: batches.length,
            reusedBatches,
            waitingRetrySec: waitSec
          });
        }
      });
      if (cacheKey) {
        writePartialBatchWav(cacheKey, i, fingerprint, wavBuffer);
      }
    }
    clipInputs.push({
      id: batch.id,
      wavBuffer,
      pauseAfterMs: batch.pauseAfterMs
    });
    onProgress?.({
      state: "synthesizing",
      completedBatches: i + 1,
      totalBatches: batches.length,
      reusedBatches
    });
  }
  const merged = concatWavClips(clipInputs);
  const segments = expandBatchTimingsToTurns(batches, merged.timings);
  if (cacheKey) {
    clearPartialBatchCache(cacheKey);
  }
  return {
    wavBuffer: merged.wavBuffer,
    durationSec: merged.durationSec,
    segments,
    reusedBatches,
    totalBatches: batches.length
  };
}
async function analyzeLiteraryExcerpt(params) {
  const ai = getGeminiClient();
  const prompt = `Analise a f\xE1bula ou conto infantil em dom\xEDnio p\xFAblico abaixo e pr\xE9-ajuste o texto em um roteiro de conta\xE7\xE3o dramatizada com m\xFAltiplas vozes naturais em portugu\xEAs do Brasil.

Regras obrigat\xF3rias:
1. Preserve o texto da hist\xF3ria integralmente, separando o Contador de Hist\xF3rias (narrador) e as falas diretas dos personagens (animais, fadas, crian\xE7as, reis, etc.) em turnos claros (m\xE1ximo de 10 turnos).
2. Para cada personagem/narrador, escolha a voz mais adequada entre exatamente estas op\xE7\xF5es: Charon, Kore, Puck, Fenrir, Zephyr.
   - Charon: voz grave e acolhedora (Contador de Hist\xF3rias, av\xF4s, narradores)
   - Kore: voz feminina clara e maternal (m\xE3es, fadas, rainhas, tartaruga, animais s\xE1bios)
   - Puck: voz jovem, saltitante e \xE1gil (crian\xE7as, ratinhos, lebres, gatos de botas, her\xF3is)
   - Fenrir: voz firme, profunda e imponente (le\xF5es, lobos, gigantes, reis, corvos)
   - Zephyr: voz leve, musical e encantada (cigarras, raposas astutas, princesas, cisnes)
3. Escreva uma dire\xE7\xE3o vocal expressiva em portugu\xEAs (campo "style") descrevendo o tom, o ritmo e a emo\xE7\xE3o de cada fala para leitura infantil.
4. Extraia ou formule a moral da f\xE1bula / ensinamento do conto em uma frase clara no campo "moral".

T\xEDtulo da f\xE1bula ou conto: ${params.title}

Texto original:
${params.rawText}`;
  const response = await withRetry(
    () => ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "Resumo encantador de 1 frase da f\xE1bula ou conto infantil em portugu\xEAs."
            },
            moral: {
              type: Type.STRING,
              description: "Moral da f\xE1bula ou ensinamento principal do conto em 1 frase."
            },
            aiNotes: {
              type: Type.STRING,
              description: "Resumo t\xE9cnico curto do ajuste vocal feito pela IA (ex.: Roteiro pr\xE9-ajustado por IA \xB7 3 vozes e pausas expressivas)."
            },
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  role: { type: Type.STRING, enum: ["narrator", "character"] },
                  description: { type: Type.STRING },
                  defaultVoice: {
                    type: Type.STRING,
                    enum: ["Charon", "Kore", "Puck", "Fenrir", "Zephyr"]
                  },
                  defaultStyle: { type: Type.STRING }
                },
                required: ["name", "role", "description", "defaultVoice", "defaultStyle"]
              }
            },
            turns: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  speaker: { type: Type.STRING },
                  role: { type: Type.STRING, enum: ["narrator", "character"] },
                  style: { type: Type.STRING },
                  text: { type: Type.STRING },
                  pauseAfterMs: { type: Type.INTEGER }
                },
                required: ["speaker", "role", "style", "text"]
              }
            }
          },
          required: ["summary", "moral", "aiNotes", "characters", "turns"]
        }
      }
    })
  );
  const rawJson = (response.text ?? "").trim();
  if (!rawJson) {
    throw new Error("A an\xE1lise do conto n\xE3o retornou resultado estruturado.");
  }
  const parsed = JSON.parse(rawJson);
  const characters = (parsed.characters ?? []).map((c, idx) => ({
    name: c.name?.trim() || (idx === 0 ? "Contador de Hist\xF3rias" : `Personagem ${idx}`),
    role: c.role === "character" ? "character" : "narrator",
    description: c.description?.trim() || "Voz interpretativa do conto.",
    defaultVoice: VALID_VOICES.includes(c.defaultVoice) ? c.defaultVoice : "Charon",
    defaultStyle: c.defaultStyle?.trim() || "Conta\xE7\xE3o expressiva em portugu\xEAs brasileiro"
  }));
  const turns = (parsed.turns ?? []).filter((t) => t.text && t.text.trim().length > 0).map((t, idx) => ({
    id: `custom-t-${Date.now()}-${idx}`,
    speaker: t.speaker?.trim() || characters[0]?.name || "Contador de Hist\xF3rias",
    role: t.role === "character" ? "character" : "narrator",
    style: t.style?.trim() || "Conta\xE7\xE3o expressiva e acolhedora",
    text: t.text.trim(),
    pauseAfterMs: typeof t.pauseAfterMs === "number" && t.pauseAfterMs >= 120 && t.pauseAfterMs <= 800 ? t.pauseAfterMs : 300
  }));
  if (turns.length === 0) {
    throw new Error("N\xE3o foi poss\xEDvel extrair falas v\xE1lidas do conto enviado.");
  }
  return {
    summary: parsed.summary?.trim() || "F\xE1bula ou conto infantil pr\xE9-ajustado por IA para leitura em m\xFAltiplas vozes.",
    moral: parsed.moral?.trim() || "Toda boa hist\xF3ria guarda uma semente de sabedoria para quem sabe escutar.",
    aiNotes: parsed.aiNotes?.trim() || `Roteiro pr\xE9-ajustado por IA \xB7 ${characters.length} vozes calibradas para leitura dramatizada`,
    characters: characters.length > 0 ? characters : [
      {
        name: "Contador de Hist\xF3rias",
        role: "narrator",
        description: "Voz narrativa principal.",
        defaultVoice: "Charon",
        defaultStyle: "Contador de hist\xF3rias em portugu\xEAs brasileiro"
      }
    ],
    turns
  };
}

// server/ttsQueue.ts
var pacer = new AdaptivePacer(2e3);
var pacingSec = 4;
var activeJob = null;
var dailyQuotaPaused = false;
var dailyQuotaMessage;
var inflightForeground = /* @__PURE__ */ new Map();
var queueTasks = [];
var workerChain = Promise.resolve();
var workerRunning = false;
function serializeExecution(fn) {
  const run = workerChain.then(fn, fn);
  workerChain = run.then(
    () => void 0,
    () => void 0
  );
  return run;
}
function setTtsPacingSec(seconds) {
  const clamped = Math.max(1, Math.min(30, Math.round(seconds)));
  pacingSec = clamped;
  pacer.setBaseSpacingMs(clamped * 1e3);
  return pacingSec;
}
function getTtsStatus() {
  return {
    activeJob,
    queue: queueTasks.map((t) => ({ ...t.item })),
    pacingSec,
    dailyQuotaPaused,
    dailyQuotaMessage
  };
}
async function runForegroundSynthesis(params) {
  const safeMode = params.mode === "narrator" ? "narrator" : "dramatized";
  const safeVoiceMap = params.voiceMap ?? {};
  const cacheKey = computeChapterCacheKey({
    chapterId: params.chapterId,
    mode: safeMode,
    turns: params.turns,
    voiceMap: safeVoiceMap
  });
  if (!params.forceRegenerate) {
    const existing = readCachedAudio(cacheKey);
    if (existing) {
      return { metadata: existing, cached: true };
    }
  }
  let promise = inflightForeground.get(cacheKey);
  if (!promise) {
    promise = serializeExecution(async () => {
      if (!params.forceRegenerate) {
        const rechecked = readCachedAudio(cacheKey);
        if (rechecked) return rechecked;
      }
      dailyQuotaPaused = false;
      dailyQuotaMessage = void 0;
      try {
        const result = await synthesizeChapterAudio({
          turns: params.turns,
          voiceMap: safeVoiceMap,
          mode: safeMode,
          cacheKey,
          forceRegenerate: params.forceRegenerate,
          pacer,
          minSpacingMs: Math.min(pacingSec * 1e3, 3e3),
          onProgress: (progress) => {
            activeJob = {
              chapterId: params.chapterId,
              chapterTitle: params.chapterTitle,
              cacheKey,
              source: "foreground",
              ...progress
            };
          }
        });
        const saved = writeCachedAudio(cacheKey, result.wavBuffer, {
          chapterId: params.chapterId,
          bookTitle: params.bookTitle,
          chapterTitle: params.chapterTitle,
          mode: safeMode,
          voiceMap: safeVoiceMap,
          durationSec: result.durationSec,
          segments: result.segments
        });
        for (const q of queueTasks) {
          if (q.cacheKey === cacheKey) {
            q.item.status = "done";
          }
        }
        return saved;
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err ?? "");
        if (isDailyQuotaError(raw)) {
          dailyQuotaPaused = true;
          dailyQuotaMessage = formatGeminiError(err, "Cota di\xE1ria atingida.");
        }
        throw err;
      } finally {
        if (activeJob?.cacheKey === cacheKey) {
          activeJob = null;
        }
      }
    }).finally(() => {
      inflightForeground.delete(cacheKey);
    });
    inflightForeground.set(cacheKey, promise);
  }
  const metadata = await promise;
  return { metadata, cached: false };
}
function scheduleBackgroundWorker() {
  if (workerRunning) return;
  workerRunning = true;
  void (async () => {
    try {
      while (true) {
        if (dailyQuotaPaused) break;
        const nextTask = queueTasks.find((t) => t.item.status === "queued");
        if (!nextTask) break;
        await serializeExecution(async () => {
          if (dailyQuotaPaused || nextTask.item.status !== "queued") return;
          const existing = readCachedAudio(nextTask.cacheKey);
          if (existing) {
            nextTask.item.status = "done";
            return;
          }
          nextTask.item.status = "running";
          try {
            const result = await synthesizeChapterAudio({
              turns: nextTask.turns,
              voiceMap: nextTask.voiceMap,
              mode: nextTask.item.mode,
              cacheKey: nextTask.cacheKey,
              pacer,
              minSpacingMs: pacingSec * 1e3,
              onProgress: (progress) => {
                activeJob = {
                  chapterId: nextTask.item.chapterId,
                  chapterTitle: nextTask.item.chapterTitle,
                  cacheKey: nextTask.cacheKey,
                  source: "queue",
                  ...progress
                };
              }
            });
            writeCachedAudio(nextTask.cacheKey, result.wavBuffer, {
              chapterId: nextTask.item.chapterId,
              bookTitle: nextTask.bookTitle,
              chapterTitle: nextTask.item.chapterTitle,
              mode: nextTask.item.mode,
              voiceMap: nextTask.voiceMap,
              durationSec: result.durationSec,
              segments: result.segments
            });
            nextTask.item.status = "done";
          } catch (err) {
            const raw = err instanceof Error ? err.message : String(err ?? "");
            const friendly = formatGeminiError(err, "Falha ao pr\xE9-gerar cap\xEDtulo.");
            nextTask.item.status = "failed";
            nextTask.item.error = friendly;
            if (isDailyQuotaError(raw)) {
              dailyQuotaPaused = true;
              dailyQuotaMessage = friendly;
            }
          } finally {
            if (activeJob?.cacheKey === nextTask.cacheKey) {
              activeJob = null;
            }
          }
        });
      }
    } finally {
      workerRunning = false;
    }
  })();
}
function enqueueBackgroundChapters(params) {
  if (typeof params.pacingSec === "number" && Number.isFinite(params.pacingSec)) {
    setTtsPacingSec(params.pacingSec);
  }
  dailyQuotaPaused = false;
  dailyQuotaMessage = void 0;
  let added = 0;
  let skippedCached = 0;
  const safeMode = params.mode === "narrator" ? "narrator" : "dramatized";
  while (queueTasks.length > 25) {
    const finishedIdx = queueTasks.findIndex(
      (t) => t.item.status === "done" || t.item.status === "failed"
    );
    if (finishedIdx >= 0) {
      queueTasks.splice(finishedIdx, 1);
    } else {
      break;
    }
  }
  for (const chapterId of params.chapterIds.slice(0, 12)) {
    const found = getChapterById(params.bookId, chapterId);
    if (!found) continue;
    const voiceMap = {};
    for (const ch of found.chapter.characters) {
      voiceMap[ch.name] = ch.defaultVoice;
    }
    const cacheKey = computeChapterCacheKey({
      chapterId: found.chapter.id,
      mode: safeMode,
      turns: found.chapter.turns,
      voiceMap
    });
    if (readCachedAudio(cacheKey)) {
      skippedCached += 1;
      continue;
    }
    const alreadyQueued = queueTasks.some(
      (t) => t.cacheKey === cacheKey && (t.item.status === "queued" || t.item.status === "running")
    );
    if (alreadyQueued) continue;
    queueTasks.push({
      item: {
        id: `${found.chapter.id}-${Date.now().toString(36).slice(-4)}`,
        bookId: found.book.id,
        chapterId: found.chapter.id,
        chapterTitle: `${found.chapter.numberLabel} \u2014 ${found.chapter.title}`,
        mode: safeMode,
        status: "queued"
      },
      bookTitle: found.book.title,
      turns: found.chapter.turns,
      voiceMap,
      cacheKey
    });
    added += 1;
  }
  if (added > 0) {
    scheduleBackgroundWorker();
  }
  return {
    added,
    skippedCached,
    status: getTtsStatus()
  };
}
function clearBackgroundQueue() {
  for (let i = queueTasks.length - 1; i >= 0; i--) {
    if (queueTasks[i].item.status !== "running") {
      queueTasks.splice(i, 1);
    }
  }
  dailyQuotaPaused = false;
  dailyQuotaMessage = void 0;
  return getTtsStatus();
}
function removeQueueItem(chapterId) {
  const idx = queueTasks.findIndex(
    (t) => t.item.chapterId === chapterId && t.item.status !== "running"
  );
  if (idx >= 0) {
    queueTasks.splice(idx, 1);
  }
  return getTtsStatus();
}

// server/apiApp.ts
async function fetchGutenbergText(gutenbergId) {
  const urls = [
    `https://gutenberg.pglaf.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`,
    `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`,
    `https://www.gutenberg.org/files/${gutenbergId}/${gutenbergId}-0.txt`
  ];
  let lastError = "N\xE3o foi poss\xEDvel baixar o texto do Project Gutenberg.";
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15e3);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "VozEFolha-PublicDomainReader/1.0" }
      });
      clearTimeout(timeout);
      if (response.ok) {
        const text = await response.text();
        if (text.length > 500) {
          return text;
        }
      } else {
        lastError = `Project Gutenberg retornou status ${response.status} para a obra #${gutenbergId}.`;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Tempo esgotado ao acessar o acervo p\xFAblico.";
    }
  }
  throw new Error(lastError);
}
function createApiApp() {
  const app2 = express();
  app2.use(express.json({ limit: "6mb" }));
  app2.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app2.get("/api/books", (_req, res) => {
    const cacheInventory = listCachedAudios();
    res.json({
      books: getBookCatalog(),
      cache: cacheInventory
    });
  });
  app2.get("/api/public-domain/catalog", (_req, res) => {
    const installedIds = getInstalledBookIds();
    const installedGutenberg = getInstalledGutenbergIds();
    const items = PUBLIC_DOMAIN_CATALOG.map((entry) => ({
      gutenbergId: entry.gutenbergId,
      slug: entry.slug,
      title: entry.title,
      author: entry.author,
      year: entry.year,
      synopsis: entry.synopsis,
      narratorName: entry.narratorName,
      installed: installedIds.has(entry.slug) || installedGutenberg.has(entry.gutenbergId)
    }));
    res.json({ items });
  });
  app2.post("/api/books/import-gutenberg", async (req, res) => {
    try {
      const gutenbergId = Number.parseInt(String(req.body?.gutenbergId ?? ""), 10);
      if (!Number.isFinite(gutenbergId) || gutenbergId <= 0 || gutenbergId > 999999) {
        res.status(400).json({ error: "Informe um n\xFAmero de cat\xE1logo v\xE1lido." });
        return;
      }
      const curated = PUBLIC_DOMAIN_CATALOG.find((item) => item.gutenbergId === gutenbergId);
      const existingCatalog = getBookCatalog();
      const alreadyInstalled = existingCatalog.find(
        (b) => b.gutenbergId === gutenbergId || curated && b.id === curated.slug
      );
      if (alreadyInstalled) {
        const firstCh = getChapterById(alreadyInstalled.id, alreadyInstalled.chapters[0]?.id ?? "");
        res.json({
          book: alreadyInstalled,
          firstChapter: firstCh?.chapter ?? null,
          catalog: existingCatalog,
          alreadyInstalled: true
        });
        return;
      }
      if (curated?.prebuiltChapters && curated.prebuiltChapters.length > 0) {
        const newBook2 = {
          id: curated.slug,
          title: curated.title,
          author: curated.author,
          year: curated.year,
          publicDomainSource: "Dom\xEDnio P\xFAblico \xB7 Roteiro pr\xE9-ajustado por IA",
          coverUrl: "",
          synopsis: curated.synopsis,
          gutenbergId: curated.gutenbergId,
          isCustom: true,
          chapters: curated.prebuiltChapters
        };
        const saved2 = saveBookToLibrary(newBook2);
        res.json({
          book: toBookCatalogItem(saved2),
          firstChapter: saved2.chapters[0],
          catalog: getBookCatalog(),
          alreadyInstalled: false
        });
        return;
      }
      const rawText = await fetchGutenbergText(gutenbergId);
      const extracted = extractGutenbergMetadata(rawText);
      const parsedChapters = parsePublicDomainBookText(rawText);
      if (parsedChapters.length === 0) {
        res.status(422).json({
          error: "N\xE3o foi poss\xEDvel extrair contos ou cap\xEDtulos leg\xEDveis desta obra."
        });
        return;
      }
      const title = typeof req.body?.title === "string" && req.body.title.trim() || curated?.title || extracted.title || `Obra em Dom\xEDnio P\xFAblico #${gutenbergId}`;
      const author = typeof req.body?.author === "string" && req.body.author.trim() || curated?.author || extracted.author || "Dom\xEDnio P\xFAblico";
      const year = typeof req.body?.year === "number" && Number.isFinite(req.body.year) ? req.body.year : curated?.year ?? 1890;
      const synopsis = typeof req.body?.synopsis === "string" && req.body.synopsis.trim() || curated?.synopsis || `Edi\xE7\xE3o em dom\xEDnio p\xFAblico (#${gutenbergId}).`;
      const installedIds = getInstalledBookIds();
      let bookId = curated?.slug || slugifyBookId(title);
      if (installedIds.has(bookId)) {
        bookId = `${bookId}-${gutenbergId}`;
      }
      const chapters = parsedChapters.map(
        (raw) => buildChapterFromRaw(raw, bookId, {
          bookTitle: title,
          narratorName: curated?.narratorName || "Contador de Hist\xF3rias"
        })
      );
      const newBook = {
        id: bookId,
        title,
        author,
        year,
        publicDomainSource: `Dom\xEDnio P\xFAblico \xB7 Project Gutenberg #${gutenbergId}`,
        coverUrl: "",
        synopsis,
        gutenbergId,
        isCustom: true,
        chapters
      };
      const saved = saveBookToLibrary(newBook);
      res.json({
        book: toBookCatalogItem(saved),
        firstChapter: saved.chapters[0],
        catalog: getBookCatalog(),
        alreadyInstalled: false
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "N\xE3o foi poss\xEDvel adicionar a cole\xE7\xE3o do dom\xEDnio p\xFAblico."
      });
    }
  });
  app2.post("/api/books/import-text", (req, res) => {
    try {
      const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
      const author = typeof req.body?.author === "string" && req.body.author.trim() ? req.body.author.trim() : "Tradi\xE7\xE3o Popular";
      const rawText = typeof req.body?.rawText === "string" ? req.body.rawText.trim() : "";
      const yearRaw = Number.parseInt(String(req.body?.year ?? ""), 10);
      const year = Number.isFinite(yearRaw) && yearRaw >= 1e3 && yearRaw <= 2100 ? yearRaw : (/* @__PURE__ */ new Date()).getFullYear();
      if (!title) {
        res.status(400).json({ error: "Informe o t\xEDtulo da cole\xE7\xE3o ou conto antes de importar." });
        return;
      }
      if (rawText.length < 40) {
        res.status(400).json({
          error: "Envie ou cole o texto da f\xE1bula ou conto (m\xEDnimo de 40 caracteres)."
        });
        return;
      }
      const parsedChapters = parsePublicDomainBookText(rawText);
      if (parsedChapters.length === 0) {
        res.status(422).json({ error: "N\xE3o foi poss\xEDvel identificar texto leg\xEDvel para importar." });
        return;
      }
      const installedIds = getInstalledBookIds();
      let bookId = slugifyBookId(title);
      if (installedIds.has(bookId)) {
        bookId = `${bookId}-${Date.now().toString(36).slice(-4)}`;
      }
      const chapters = parsedChapters.map(
        (raw) => buildChapterFromRaw(raw, bookId, {
          bookTitle: title,
          narratorName: "Contador de Hist\xF3rias"
        })
      );
      const newBook = {
        id: bookId,
        title,
        author,
        year,
        publicDomainSource: "F\xE1bula ou conto importado pelo leitor",
        coverUrl: "",
        synopsis: `${chapters.length} ${chapters.length === 1 ? "conto importado" : "contos importados"} pelo leitor.`,
        isCustom: true,
        chapters
      };
      const saved = saveBookToLibrary(newBook);
      res.json({
        book: toBookCatalogItem(saved),
        firstChapter: saved.chapters[0],
        catalog: getBookCatalog()
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "N\xE3o foi poss\xEDvel importar o conto."
      });
    }
  });
  app2.delete("/api/books/:bookId", (req, res) => {
    try {
      const removed = deleteCustomBook(String(req.params.bookId));
      res.json({ removed, catalog: getBookCatalog() });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "N\xE3o foi poss\xEDvel remover a cole\xE7\xE3o."
      });
    }
  });
  app2.get("/api/books/:bookId/chapters/:chapterId", (req, res) => {
    const found = getChapterById(String(req.params.bookId), String(req.params.chapterId));
    if (!found) {
      res.status(404).json({ error: "F\xE1bula ou conto n\xE3o encontrado na biblioteca." });
      return;
    }
    res.json({ chapter: found.chapter });
  });
  app2.post("/api/chapters/:chapterId/dramatize", async (req, res) => {
    try {
      const chapterId = String(req.params.chapterId);
      const bookId = typeof req.body?.bookId === "string" ? req.body.bookId : "fabulas-esopo";
      const force = Boolean(req.body?.force);
      const found = getChapterById(bookId, chapterId);
      if (!found) {
        res.status(404).json({ error: "F\xE1bula ou conto n\xE3o encontrado para ajuste com IA." });
        return;
      }
      if (!force) {
        const existingScript = readCachedDramatizedScript(chapterId);
        if (existingScript) {
          res.json({
            chapter: {
              ...found.chapter,
              summary: existingScript.summary || found.chapter.summary,
              moral: existingScript.moral || found.chapter.moral,
              aiNotes: existingScript.aiNotes || found.chapter.aiNotes,
              characters: existingScript.characters,
              turns: existingScript.turns,
              characterCount: existingScript.characters.length,
              dramatizedByAi: true
            },
            cached: true
          });
          return;
        }
      }
      const rawText = found.chapter.turns.map((t) => t.role === "character" ? `\u2014 ${t.text}` : t.text).join("\n\n");
      const analyzed = await analyzeLiteraryExcerpt({
        title: `${found.chapter.numberLabel} \u2014 ${found.chapter.title}`,
        rawText
      });
      const saved = writeCachedDramatizedScript(chapterId, analyzed);
      res.json({
        chapter: {
          ...found.chapter,
          summary: saved.summary || found.chapter.summary,
          moral: saved.moral || found.chapter.moral,
          aiNotes: saved.aiNotes || found.chapter.aiNotes,
          characters: saved.characters,
          turns: saved.turns,
          characterCount: saved.characters.length,
          dramatizedByAi: true
        },
        cached: false
      });
    } catch (err) {
      const message = formatGeminiError(
        err,
        "N\xE3o foi poss\xEDvel reajustar o roteiro de vozes desta f\xE1bula."
      );
      res.status(500).json({ error: message });
    }
  });
  app2.get("/api/cache", (_req, res) => {
    res.json(listCachedAudios());
  });
  app2.delete("/api/cache/:cacheKey", (req, res) => {
    try {
      const removed = deleteCachedAudio(String(req.params.cacheKey));
      res.json({ removed, inventory: listCachedAudios() });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "N\xE3o foi poss\xEDvel remover o item do cache."
      });
    }
  });
  app2.post("/api/chapters/cache-lookup", (req, res) => {
    try {
      const { chapterId, mode, turns, voiceMap } = req.body;
      if (!chapterId || !Array.isArray(turns) || turns.length === 0) {
        res.status(400).json({ error: "Dados da hist\xF3ria incompletos para consulta de cache." });
        return;
      }
      const cacheKey = computeChapterCacheKey({
        chapterId,
        mode: mode === "narrator" ? "narrator" : "dramatized",
        turns,
        voiceMap: voiceMap ?? {}
      });
      const cached = readCachedAudio(cacheKey);
      res.json({
        cacheKey,
        cached: Boolean(cached),
        metadata: cached
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Erro ao consultar cache de \xE1udio."
      });
    }
  });
  app2.get("/api/tts/status", (_req, res) => {
    res.json(getTtsStatus());
  });
  app2.post("/api/tts/queue", (req, res) => {
    try {
      const { bookId, chapterIds, mode, pacingSec: pacingSec2 } = req.body;
      if (!bookId || !Array.isArray(chapterIds) || chapterIds.length === 0) {
        res.status(400).json({ error: "Informe a cole\xE7\xE3o e as f\xE1bulas para pr\xE9-renderizar em fila." });
        return;
      }
      const result = enqueueBackgroundChapters({
        bookId,
        chapterIds,
        mode: mode === "narrator" ? "narrator" : "dramatized",
        pacingSec: pacingSec2
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "N\xE3o foi poss\xEDvel enfileirar as hist\xF3rias."
      });
    }
  });
  app2.patch("/api/tts/pacing", (req, res) => {
    const raw = Number(req.body?.pacingSec);
    if (!Number.isFinite(raw) || raw < 1 || raw > 30) {
      res.status(400).json({ error: "Informe um intervalo entre 1 e 30 segundos." });
      return;
    }
    const updated = setTtsPacingSec(raw);
    res.json({ pacingSec: updated, status: getTtsStatus() });
  });
  app2.delete("/api/tts/queue", (_req, res) => {
    res.json({ status: clearBackgroundQueue() });
  });
  app2.delete("/api/tts/queue/:chapterId", (req, res) => {
    res.json({ status: removeQueueItem(String(req.params.chapterId)) });
  });
  app2.post("/api/chapters/synthesize", async (req, res) => {
    try {
      const {
        chapterId,
        bookTitle,
        chapterTitle,
        mode,
        turns,
        voiceMap,
        forceRegenerate
      } = req.body;
      if (!chapterId || !Array.isArray(turns) || turns.length === 0) {
        res.status(400).json({ error: "Envie uma f\xE1bula ou conto com ao menos um trecho de texto." });
        return;
      }
      const result = await runForegroundSynthesis({
        chapterId,
        bookTitle: bookTitle || "F\xE1bulas e Contos em Dom\xEDnio P\xFAblico",
        chapterTitle: chapterTitle || "Conto",
        mode: mode === "narrator" ? "narrator" : "dramatized",
        turns,
        voiceMap: voiceMap ?? {},
        forceRegenerate: Boolean(forceRegenerate)
      });
      res.setHeader("X-Audio-Cache", result.cached ? "HIT" : "MISS");
      res.json({ ...result.metadata, cached: result.cached });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err ?? "");
      const message = formatGeminiError(err, "N\xE3o foi poss\xEDvel pr\xE9-renderizar o \xE1udio desta hist\xF3ria.");
      const quotaError = isRateLimitError(raw) || isDailyQuotaError(raw);
      const status = raw.includes("API_KEY") || raw.includes("PERMISSION_DENIED") ? 403 : quotaError ? 429 : 500;
      res.status(status).json({
        error: message,
        isQuotaError: quotaError
      });
    }
  });
  app2.post("/api/chapters/analyze", async (req, res) => {
    try {
      const { title, rawText } = req.body;
      const trimmedTitle = (title ?? "").trim();
      const trimmedText = (rawText ?? "").trim();
      if (!trimmedTitle) {
        res.status(400).json({ error: "Informe um t\xEDtulo para a f\xE1bula ou conto." });
        return;
      }
      if (trimmedText.length < 30) {
        res.status(400).json({ error: "Cole pelo menos um par\xE1grafo curto (m\xEDnimo de 30 caracteres)." });
        return;
      }
      if (trimmedText.length > 8e3) {
        res.status(400).json({ error: "Limite de 8.000 caracteres por conto importado." });
        return;
      }
      const analyzed = await analyzeLiteraryExcerpt({
        title: trimmedTitle,
        rawText: trimmedText
      });
      res.json(analyzed);
    } catch (err) {
      const message = formatGeminiError(
        err,
        "N\xE3o foi poss\xEDvel pr\xE9-ajustar o texto com intelig\xEAncia artificial."
      );
      res.status(500).json({ error: message });
    }
  });
  app2.get("/api/audio/:cacheKey", (req, res) => {
    try {
      const cacheKey = String(req.params.cacheKey);
      const meta = readCachedAudio(cacheKey);
      if (!meta) {
        res.status(404).json({ error: "\xC1udio n\xE3o encontrado no cache." });
        return;
      }
      const filePath = getWavFilePath(cacheKey);
      const stat = fs3.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("X-Audio-Cache", "HIT");
      if (req.query.download === "1") {
        const safeName = `${meta.chapterId}-${meta.mode}.wav`.replace(/[^a-zA-Z0-9._-]/g, "_");
        res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
      }
      if (range) {
        const match = /bytes=(\d+)-(\d*)/.exec(range);
        if (match) {
          const start = Number.parseInt(match[1], 10);
          const end = match[2] ? Number.parseInt(match[2], 10) : fileSize - 1;
          if (start >= fileSize || end >= fileSize || start > end) {
            res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
            return;
          }
          res.status(206);
          res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
          res.setHeader("Content-Length", end - start + 1);
          fs3.createReadStream(filePath, { start, end }).pipe(res);
          return;
        }
      }
      res.setHeader("Content-Length", fileSize);
      fs3.createReadStream(filePath).pipe(res);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : "Erro ao servir o arquivo WAV."
      });
    }
  });
  return app2;
}

// server/vercelEntry.ts
var app = createApiApp();
var vercelEntry_default = app;
export {
  vercelEntry_default as default
};
