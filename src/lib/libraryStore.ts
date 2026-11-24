import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Book, Chapter, ChapterCharacter, ScriptTurn } from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';

const CUSTOM_BOOKS_COLLECTION = 'customBooks';
const DRAMATIZED_SCRIPTS_COLLECTION = 'dramatizedScripts';
const SAFE_ID_RE = /^[a-zA-Z0-9_-]{2,120}$/;
const MAX_FIRESTORE_BOOK_JSON_BYTES = 850_000;

export interface DramatizedScriptRecord {
  chapterId: string;
  summary: string;
  moral?: string;
  aiNotes?: string;
  characters: ChapterCharacter[];
  turns: ScriptTurn[];
  createdByUid?: string;
  createdAt: string;
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function sanitizeSafeId(raw: string, fallback: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
  return SAFE_ID_RE.test(cleaned) ? cleaned : fallback;
}

/**
 * Subscribes in real time to public custom collections saved in Firestore.
 */
export function subscribeToCustomBooks(
  onUpdate: (books: Book[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, CUSTOM_BOOKS_COLLECTION), where('isPublic', '==', true));

  return onSnapshot(
    q,
    (snapshot) => {
      const books: Book[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Partial<Book>;
        if (!data.title || !Array.isArray(data.chapters) || data.chapters.length === 0) {
          continue;
        }
        books.push({
          id: typeof data.id === 'string' ? data.id : docSnap.id,
          title: data.title,
          author: data.author || 'Tradição Popular',
          year: typeof data.year === 'number' ? data.year : new Date().getFullYear(),
          publicDomainSource: data.publicDomainSource || 'Coleção salva no Firestore',
          coverUrl: data.coverUrl || '',
          synopsis: data.synopsis || '',
          ...(typeof data.gutenbergId === 'number' ? { gutenbergId: data.gutenbergId } : {}),
          isCustom: true,
          chapters: data.chapters,
        });
      }
      books.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
      onUpdate(books);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, CUSTOM_BOOKS_COLLECTION);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

/**
 * Persists a curator-imported collection into Firestore so it survives Vercel serverless restarts.
 */
export async function saveCustomBookToFirestore(book: Book, user: User): Promise<Book> {
  if (!user.emailVerified) {
    throw new Error('Sua conta Google precisa ter e-mail verificado para salvar coleções.');
  }

  const safeBookId = sanitizeSafeId(book.id, `colecao-${Date.now()}`);
  const chapters = (book.chapters ?? []).slice(0, 60);
  if (chapters.length === 0) {
    throw new Error('A coleção precisa ter ao menos uma história para ser salva.');
  }

  const year =
    typeof book.year === 'number' && Number.isFinite(book.year)
      ? Math.max(1000, Math.min(2100, Math.round(book.year)))
      : new Date().getFullYear();

  const payload: Record<string, unknown> = {
    id: safeBookId,
    title: (book.title || 'Coleção de Fábulas').trim().slice(0, 200),
    author: (book.author || 'Tradição Popular').trim().slice(0, 200),
    year,
    publicDomainSource: (book.publicDomainSource || 'Domínio Público').trim().slice(0, 240),
    coverUrl: (book.coverUrl || '').trim().slice(0, 500),
    synopsis: (book.synopsis || '').trim().slice(0, 1000),
    isCustom: true,
    chapters,
    isPublic: true,
    createdByUid: user.uid,
  };

  if (
    typeof book.gutenbergId === 'number' &&
    Number.isInteger(book.gutenbergId) &&
    book.gutenbergId >= 1 &&
    book.gutenbergId <= 999999
  ) {
    payload.gutenbergId = book.gutenbergId;
  }

  const serializedBytes = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  if (serializedBytes > MAX_FIRESTORE_BOOK_JSON_BYTES) {
    throw new Error(
      'Esta coleção é muito extensa para salvar em um único documento no Firestore (limite ~850 KB). Divida o texto em coleções menores.',
    );
  }

  const docPath = `${CUSTOM_BOOKS_COLLECTION}/${safeBookId}`;
  try {
    await setDoc(doc(db, CUSTOM_BOOKS_COLLECTION, safeBookId), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }

  return {
    ...book,
    id: safeBookId,
    chapters,
    isCustom: true,
  };
}

export async function deleteCustomBookFromFirestore(bookId: string): Promise<void> {
  const safeId = sanitizeSafeId(bookId, '');
  if (!safeId) return;
  const docPath = `${CUSTOM_BOOKS_COLLECTION}/${safeId}`;
  try {
    await deleteDoc(doc(db, CUSTOM_BOOKS_COLLECTION, safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

/**
 * Subscribes in real time to AI-dramatized scripts saved in Firestore.
 */
export function subscribeToDramatizedScripts(
  onUpdate: (scripts: Record<string, DramatizedScriptRecord>) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  const q = query(collection(db, DRAMATIZED_SCRIPTS_COLLECTION), where('isPublic', '==', true));

  return onSnapshot(
    q,
    (snapshot) => {
      const map: Record<string, DramatizedScriptRecord> = {};
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Record<string, unknown>;
        const chapterId = typeof data.chapterId === 'string' ? data.chapterId : docSnap.id;
        if (!Array.isArray(data.characters) || !Array.isArray(data.turns)) continue;
        map[chapterId] = {
          chapterId,
          summary: typeof data.summary === 'string' ? data.summary : '',
          moral: typeof data.moral === 'string' ? data.moral : undefined,
          aiNotes: typeof data.aiNotes === 'string' ? data.aiNotes : undefined,
          characters: data.characters as ChapterCharacter[],
          turns: data.turns as ScriptTurn[],
          createdByUid: typeof data.createdByUid === 'string' ? data.createdByUid : undefined,
          createdAt: timestampToIso(data.createdAt),
        };
      }
      onUpdate(map);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, DRAMATIZED_SCRIPTS_COLLECTION);
      } catch (wrapped) {
        onError?.(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    },
  );
}

/**
 * Persists an AI-dramatized chapter script, voice cast, and moral lesson in Firestore.
 */
export async function saveDramatizedScriptToFirestore(
  chapter: Chapter,
  user: User,
): Promise<void> {
  if (!user.emailVerified) {
    throw new Error('Sua conta Google precisa ter e-mail verificado para salvar roteiros.');
  }

  const safeChapterId = sanitizeSafeId(chapter.id, '');
  if (!safeChapterId) {
    throw new Error('Identificador de história inválido para salvar roteiro.');
  }

  const characters = (chapter.characters ?? []).slice(0, 16);
  const turns = (chapter.turns ?? []).slice(0, 80);
  if (characters.length === 0 || turns.length === 0) {
    throw new Error('Roteiro vazio não pode ser salvo.');
  }

  const payload: Record<string, unknown> = {
    chapterId: safeChapterId,
    summary: (chapter.summary || chapter.title || 'História pré-ajustada por IA')
      .trim()
      .slice(0, 600),
    characters,
    turns,
    isPublic: true,
    createdByUid: user.uid,
  };

  if (chapter.moral && chapter.moral.trim().length > 0) {
    payload.moral = chapter.moral.trim().slice(0, 600);
  }
  if (chapter.aiNotes && chapter.aiNotes.trim().length > 0) {
    payload.aiNotes = chapter.aiNotes.trim().slice(0, 400);
  }

  const docPath = `${DRAMATIZED_SCRIPTS_COLLECTION}/${safeChapterId}`;
  try {
    await setDoc(doc(db, DRAMATIZED_SCRIPTS_COLLECTION, safeChapterId), {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}
