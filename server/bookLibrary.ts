import fs from 'node:fs';
import path from 'node:path';
import { PUBLIC_DOMAIN_BOOKS } from '../src/data/books';
import type {
  Book,
  BookCatalogItem,
  Chapter,
  ChapterCharacter,
  ChapterSummary,
  ScriptTurn,
} from '../src/types';

const BOOKS_DATA_DIR = path.resolve(process.cwd(), 'data', 'books');
const SCRIPT_CACHE_DIR = path.resolve(process.cwd(), 'data', 'script-cache');
const BUILT_IN_BOOK_IDS = new Set([
  'fabulas-esopo',
  'contos-grimm-perrault',
  'contos-andersen',
]);

interface CachedScriptRecord {
  chapterId: string;
  summary: string;
  moral?: string;
  aiNotes?: string;
  characters: ChapterCharacter[];
  turns: ScriptTurn[];
  createdAt: string;
}

let cachedFullBooks: Book[] | null = null;

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function sanitizeId(id: string): string {
  if (!/^[a-zA-Z0-9_-]{2,80}$/.test(id)) {
    throw new Error('Identificador inválido.');
  }
  return id;
}

export function invalidateBookLibraryCache(): void {
  cachedFullBooks = null;
}

export function readCachedDramatizedScript(chapterId: string): CachedScriptRecord | null {
  try {
    ensureDir(SCRIPT_CACHE_DIR);
    const filePath = path.join(SCRIPT_CACHE_DIR, `${sanitizeId(chapterId)}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CachedScriptRecord;
  } catch {
    return null;
  }
}

export function writeCachedDramatizedScript(
  chapterId: string,
  payload: {
    summary: string;
    moral?: string;
    aiNotes?: string;
    characters: ChapterCharacter[];
    turns: ScriptTurn[];
  },
): CachedScriptRecord {
  ensureDir(SCRIPT_CACHE_DIR);
  const safeId = sanitizeId(chapterId);
  const filePath = path.join(SCRIPT_CACHE_DIR, `${safeId}.json`);
  const tmpPath = `${filePath}.tmp`;
  const record: CachedScriptRecord = {
    chapterId: safeId,
    summary: payload.summary,
    moral: payload.moral,
    aiNotes:
      payload.aiNotes ||
      `Roteiro pré-ajustado por IA · ${payload.characters.length} vozes calibradas para fábula/conto infantil`,
    characters: payload.characters,
    turns: payload.turns,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(tmpPath, JSON.stringify(record, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
  return record;
}

function applyScriptOverlay(chapter: Chapter): Chapter {
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
    dramatizedByAi: true,
  };
}

function readBookJsonFile(filePath: string): Partial<Book> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<Book>;
    if (Array.isArray(parsed.chapters) && parsed.chapters.length > 0) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.error(`Erro ao ler ${filePath}:`, err);
    return null;
  }
}

function loadFullBooks(): Book[] {
  if (cachedFullBooks) {
    return cachedFullBooks;
  }

  ensureDir(BOOKS_DATA_DIR);

  // 1. Hydrate built-in fable & fairy tale collections
  const books: Book[] = PUBLIC_DOMAIN_BOOKS.map((seedBook) => {
    const fullFile = readBookJsonFile(path.join(BOOKS_DATA_DIR, `${seedBook.id}.json`));
    if (fullFile?.chapters && fullFile.chapters.length > 0) {
      return {
        ...seedBook,
        publicDomainSource: fullFile.publicDomainSource || seedBook.publicDomainSource,
        gutenbergId: fullFile.gutenbergId ?? seedBook.gutenbergId,
        chapters: fullFile.chapters,
      };
    }
    return seedBook;
  });

  // 2. Load any additional books saved in data/books/*.json
  const knownIds = new Set(books.map((b) => b.id));
  const files = fs.readdirSync(BOOKS_DATA_DIR).filter((f) => f.endsWith('.json'));
  const extraBooks: Book[] = [];

  for (const file of files) {
    const slug = file.replace(/\.json$/, '');
    if (knownIds.has(slug)) continue;
    const parsed = readBookJsonFile(path.join(BOOKS_DATA_DIR, file));
    if (!parsed || !parsed.id || !parsed.title || !parsed.chapters) continue;
    extraBooks.push({
      id: parsed.id,
      title: parsed.title,
      author: parsed.author || 'Tradição Popular',
      year: typeof parsed.year === 'number' ? parsed.year : new Date().getFullYear(),
      publicDomainSource: parsed.publicDomainSource || 'Conto adicionado à biblioteca',
      coverUrl: parsed.coverUrl || '',
      synopsis: parsed.synopsis || '',
      gutenbergId: parsed.gutenbergId,
      isCustom: parsed.isCustom ?? true,
      chapters: parsed.chapters,
    });
    knownIds.add(parsed.id);
  }

  extraBooks.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  cachedFullBooks = [...books, ...extraBooks];
  return cachedFullBooks;
}

export function saveBookToLibrary(book: Book): Book {
  ensureDir(BOOKS_DATA_DIR);
  const safeId = sanitizeId(book.id);
  const normalized: Book = { ...book, id: safeId };
  const filePath = path.join(BOOKS_DATA_DIR, `${safeId}.json`);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(normalized, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
  invalidateBookLibraryCache();
  return normalized;
}

export function deleteCustomBook(bookId: string): boolean {
  const safeId = sanitizeId(bookId);
  if (BUILT_IN_BOOK_IDS.has(safeId)) {
    throw new Error('As coleções principais de fábulas e contos não podem ser removidas.');
  }
  const filePath = path.join(BOOKS_DATA_DIR, `${safeId}.json`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  invalidateBookLibraryCache();
  return true;
}

export function getInstalledBookIds(): Set<string> {
  return new Set(loadFullBooks().map((b) => b.id));
}

export function getInstalledGutenbergIds(): Set<number> {
  const set = new Set<number>();
  for (const book of loadFullBooks()) {
    if (typeof book.gutenbergId === 'number') {
      set.add(book.gutenbergId);
    }
  }
  return set;
}

export function toChapterSummary(chapter: Chapter): ChapterSummary {
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
    isCustom: chapter.isCustom,
  };
}

export function toBookCatalogItem(book: Book): BookCatalogItem {
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
    chapters: book.chapters.map((ch) => toChapterSummary(applyScriptOverlay(ch))),
  };
}

export function getBookCatalog(): BookCatalogItem[] {
  return loadFullBooks().map(toBookCatalogItem);
}

export function getChapterById(bookId: string, chapterId: string): { book: Book; chapter: Chapter } | null {
  const books = loadFullBooks();
  const book =
    books.find((b) => b.id === bookId) ??
    books.find((b) => b.chapters.some((c) => c.id === chapterId));
  if (!book) return null;
  const raw = book.chapters.find((c) => c.id === chapterId);
  if (!raw) return null;
  return {
    book,
    chapter: applyScriptOverlay(raw),
  };
}
