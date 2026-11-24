import type { Chapter, PublicDomainCatalogEntry } from '../types';

export interface CuratedPublicDomainEntry extends PublicDomainCatalogEntry {
  prebuiltChapters?: Chapter[];
}

/**
 * Curated catalog of Portuguese-language public-domain fables, fairy tales, and children's classics.
 * Includes pre-adjusted multi-voice AI scripts for instant addition to the library.
 */
export const PUBLIC_DOMAIN_CATALOG: CuratedPublicDomainEntry[] = [
  {
    slug: 'fabulas-esopo',
    title: 'Fábulas de Esopo',
    author: 'Esopo',
    year: 1884,
    synopsis:
      'Coleção com A Cigarra e a Formiga, A Lebre e a Tartaruga, O Leão e o Ratinho, A Raposa e as Uvas, O Corvo e a Raposa e O Rato do Campo.',
    narratorName: 'Contador de Histórias',
  },
  {
    slug: 'contos-grimm-perrault',
    title: 'Contos Clássicos da Floresta',
    author: 'Irmãos Grimm & Charles Perrault',
    year: 1812,
    synopsis:
      'Chapeuzinho Vermelho, Os Três Porquinhos, O Gato de Botas, João e o Pé de Feijão e Os Músicos de Bremen com elenco completo de vozes.',
    narratorName: 'Contador de Histórias',
  },
  {
    slug: 'contos-andersen',
    title: 'Contos de Hans Christian Andersen',
    author: 'Hans Christian Andersen',
    year: 1843,
    synopsis:
      'O Patinho Feio, A Roupa Nova do Imperador, O Soldadinho de Chumbo e A Princesa e a Ervilha pré-ajustados para leitura dramatizada.',
    narratorName: 'Contador de Histórias',
  },
  {
    slug: 'fabulas-la-fontaine',
    title: 'Fábulas de La Fontaine',
    author: 'Jean de La Fontaine',
    year: 1668,
    synopsis:
      'Versões poéticas em prosa de O Lobo e o Cordeiro e A Galinha dos Ovos de Ouro, pré-ajustadas com direção vocal e moral da história.',
    narratorName: 'Contador de Histórias',
    prebuiltChapters: [
      {
        id: 'lf-lobo-cordeiro',
        bookId: 'fabulas-la-fontaine',
        number: 1,
        roman: 'I',
        numberLabel: 'Fábula I',
        title: 'O Lobo e o Cordeiro',
        estimatedMinutes: 2,
        wordCount: 180,
        characterCount: 3,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: 'Contra quem já decidiu agir com injustiça, os argumentos mais sinceros raramente bastam; a prudência é a melhor defesa.',
        aiNotes: 'Roteiro pré-ajustado por IA · Contraste entre a mansidão do Cordeiro (Puck) e a rispidez do Lobo (Fenrir)',
        summary:
          'Bebendo água na parte baixa de um riacho cristalino, um pequeno Cordeiro responde com serenidade às acusações sem sentido de um Lobo.',
        characters: [
          {
            name: 'Contador de Histórias',
            role: 'narrator',
            description: 'Narrador clássico de La Fontaine.',
            defaultVoice: 'Charon',
            defaultStyle: 'Narrador brasileiro sereno e expressivo',
          },
          {
            name: 'O Lobo',
            role: 'character',
            description: 'Ríspido e à procura de um pretexto.',
            defaultVoice: 'Fenrir',
            defaultStyle: 'Voz grave, autoritária e impaciente',
          },
          {
            name: 'O Cordeiro',
            role: 'character',
            description: 'Educado, manso e sincero.',
            defaultVoice: 'Puck',
            defaultStyle: 'Voz jovem, suave e respeitosa',
          },
        ],
        turns: [
          {
            id: 'lflc-t1',
            speaker: 'Contador de Histórias',
            role: 'narrator',
            style: 'Tom calmo descrevendo o riacho da montanha',
            text: 'Um pequeno Cordeiro matava a sede nas águas limpas de um regato quando um Lobo surgiu mais acima, entre as pedras, procurando motivo para discussão.',
            pauseAfterMs: 300,
          },
          {
            id: 'lflc-t2',
            speaker: 'O Lobo',
            role: 'character',
            style: 'Voz grossa e indignada',
            text: 'Como ousa sujar a água que estou bebendo, pequeno insolente?',
            pauseAfterMs: 260,
          },
          {
            id: 'lflc-t3',
            speaker: 'O Cordeiro',
            role: 'character',
            style: 'Voz mansa, educada e lógica',
            text: 'Senhor Lobo, não se zangue. Veja que estou vinte passos abaixo do senhor: a correnteza desce da sua direção para a minha, portanto jamais poderia turvar a sua água.',
            pauseAfterMs: 300,
          },
          {
            id: 'lflc-t4',
            speaker: 'Contador de Histórias',
            role: 'narrator',
            style: 'Desfecho ágil e instrutivo',
            text: 'Percebendo que o Lobo não queria conversa justa, o Cordeiro deu um salto esperto para dentro do cercado do pastor, onde os cães da fazenda o protegeram em segurança.',
            pauseAfterMs: 300,
          },
        ],
      },
      {
        id: 'lf-galinha-ovos-ouro',
        bookId: 'fabulas-la-fontaine',
        number: 2,
        roman: 'II',
        numberLabel: 'Fábula II',
        title: 'A Galinha dos Ovos de Ouro',
        estimatedMinutes: 2,
        wordCount: 170,
        characterCount: 2,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: 'A ambição apressada perde tudo ao tentar colher de uma só vez o que o tempo oferece dia após dia.',
        aiNotes: 'Roteiro pré-ajustado por IA · Narração cadenciada com diálogo do Camponês (Fenrir)',
        summary:
          'Um camponês descobre que sua galinha põe um ovo de ouro todas as manhãs, mas a pressa de enriquecer num só dia põe tudo a perder.',
        characters: [
          {
            name: 'Contador de Histórias',
            role: 'narrator',
            description: 'Narrador sábio das fábulas.',
            defaultVoice: 'Charon',
            defaultStyle: 'Narrador pausado e reflexivo',
          },
          {
            name: 'O Camponês',
            role: 'character',
            description: 'Homem impaciente deslumbrado pela riqueza súbita.',
            defaultVoice: 'Fenrir',
            defaultStyle: 'Voz primeiro maravilhada e depois impaciente',
          },
        ],
        turns: [
          {
            id: 'lfgo-t1',
            speaker: 'Contador de Histórias',
            role: 'narrator',
            style: 'Tom de espanto e maravilha no sítio',
            text: 'Certa manhã, ao recolher os ovos no galinheiro, um camponês encontrou no ninho um ovo pesado e reluzente como o próprio sol: era de ouro puro. E assim aconteceu todas as manhãs seguintes.',
            pauseAfterMs: 320,
          },
          {
            id: 'lfgo-t2',
            speaker: 'O Camponês',
            role: 'character',
            style: 'Tom apressado e ambicioso',
            text: 'Por que esperar um único ovo por dia? Deve haver um tesouro inteiro escondido lá dentro! Quero todas as moedas hoje mesmo!',
            pauseAfterMs: 280,
          },
          {
            id: 'lfgo-t3',
            speaker: 'Contador de Histórias',
            role: 'narrator',
            style: 'Tom sereno de lição moral',
            text: 'Ao desfazer o ninho mágico em sua pressa, o camponês descobriu que não havia mina alguma escondida, e aprendeu que a verdadeira prosperidade exige paciência e gratidão.',
            pauseAfterMs: 300,
          },
        ],
      },
    ],
  },
  {
    slug: 'contos-carochinha',
    title: 'Contos Populares da Carochinha',
    author: 'Tradição Oral Luso-Brasileira',
    year: 1894,
    synopsis:
      'A Festa no Céu e A Dona Baratinha recontadas com vozes divertidas, ritmo musical e expressividade para crianças.',
    narratorName: 'Contador de Histórias',
    prebuiltChapters: [
      {
        id: 'cc-festa-no-ceu',
        bookId: 'contos-carochinha',
        number: 1,
        roman: 'I',
        numberLabel: 'Conto I',
        title: 'A Festa no Céu',
        estimatedMinutes: 2,
        wordCount: 195,
        characterCount: 3,
        hasDialogue: true,
        dramatizedByAi: true,
        moral: 'A esperteza pode levar longe, mas é bom lembrar do caminho de volta antes de saltar nas nuvens.',
        aiNotes: 'Roteiro pré-ajustado por IA · Folclore brasileiro com o Jabuti (Puck) e o Urubu Violeiro (Fenrir)',
        summary:
          'Todas as aves foram convidadas para um grande baile nas nuvens — e o Jabuti, mesmo sem asas, resolveu dar um jeito de comparecer escondido na viola.',
        characters: [
          {
            name: 'Contador de Histórias',
            role: 'narrator',
            description: 'Contador de causos e contos populares brasileiros.',
            defaultVoice: 'Charon',
            defaultStyle: 'Narrador brasileiro caloroso, musical e divertido',
          },
          {
            name: 'O Jabuti',
            role: 'character',
            description: 'Astuto, festeiro e cheio de conversa.',
            defaultVoice: 'Puck',
            defaultStyle: 'Voz alegre, travessa e confiante',
          },
          {
            name: 'O Urubu Violeiro',
            role: 'character',
            description: 'Músico das alturas que leva sua viola para a festa.',
            defaultVoice: 'Fenrir',
            defaultStyle: 'Voz grave, serena e surpresa com o peso da viola',
          },
        ],
        turns: [
          {
            id: 'ccfc-t1',
            speaker: 'Contador de Histórias',
            role: 'narrator',
            style: 'Tom festivo de conto popular brasileiro',
            text: 'Espalhou-se pela floresta a notícia de que haveria uma grande festa no céu, mas só quem tivesse asas poderia voar até as nuvens. O Jabuti, que adorava música, escondeu-se bem quietinho dentro da viola do compadre Urubu.',
            pauseAfterMs: 320,
          },
          {
            id: 'ccfc-t2',
            speaker: 'O Urubu Violeiro',
            role: 'character',
            style: 'Estranhando o peso enquanto bate as asas',
            text: 'Puxa vida, minha viola hoje parece mais pesada do que de costume! Deve ser a umidade da manhã na beira do rio.',
            pauseAfterMs: 280,
          },
          {
            id: 'ccfc-t3',
            speaker: 'O Jabuti',
            role: 'character',
            style: 'Saindo da viola no meio das nuvens com alegria',
            text: 'Boa noite, passarada! Quem disse que jabuti não sabe dançar ciranda nas nuvens?',
            pauseAfterMs: 300,
          },
          {
            id: 'ccfc-t4',
            speaker: 'Contador de Histórias',
            role: 'narrator',
            style: 'Desfecho divertido explicando os remendos do casco do jabuti',
            text: 'Depois de dançar a noite inteira, o Jabuti voltou na viola, caiu num tapete de folhas macias e remendou seu casco peça por peça — e é por isso que, até hoje, todo jabuti tem o casco cheio de desenhinhos.',
            pauseAfterMs: 300,
          },
        ],
      },
    ],
  },
];
