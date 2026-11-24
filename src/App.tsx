import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { AlertCircle, BookOpen, Moon, Sun, Volume2, X } from 'lucide-react';
import { PUBLIC_DOMAIN_BOOKS } from './data/books';
import {
  getStaticCacheInventory,
  mergeWithStaticCacheInventory,
  STATIC_PRERENDERED_AUDIOS,
} from './data/prerenderedAudioCatalog';
import { authFetch, safeParseJson } from './lib/apiClient';
import {
  downloadAudioFile,
  evictBrowserAudioCache,
  fetchAudioBytesForStorage,
  getPlayableAudioBlobUrl,
} from './lib/browserAudioCache';
import { BrowserSpeechReader, isBrowserSpeechSupported } from './lib/browserSpeech';
import {
  auth,
  formatFriendlyFirestoreError,
  isAdminUser,
  signInWithGoogle,
  signOutUser,
} from './lib/firebase';
import {
  deletePrerenderedAudioFromFirestore,
  savePrerenderedAudioToFirestore,
  subscribeToPrerenderedAudios,
} from './lib/prerenderedAudioStore';
import {
  deleteCustomBookFromFirestore,
  saveCustomBookToFirestore,
  saveDramatizedScriptToFirestore,
  subscribeToCustomBooks,
  subscribeToDramatizedScripts,
  type DramatizedScriptRecord,
} from './lib/libraryStore';
import { isDailyQuotaError } from './lib/rateLimit';
import { computeChapterCacheKey, findActiveSegmentIndex } from './lib/scriptParser';
import type {
  AudioSegmentTiming,
  Book,
  BookCatalogItem,
  CachedAudioMetadata,
  CacheInventoryResponse,
  Chapter,
  ChapterSummary,
  PrebuiltVoiceName,
  ReadingMode,
  SynthesizeResponse,
  TtsQueueItem,
  TtsStatusResponse,
} from './types';
import { AddBookSheet } from './components/AddBookSheet';
import { AudioDock } from './components/AudioDock';
import { ChapterReader } from './components/ChapterReader';
import { ChaptersListContent, ChaptersSheet } from './components/ChaptersSheet';
import { ImportChapterSheet } from './components/ImportChapterSheet';
import { VoicesCacheSheet } from './components/VoicesCacheSheet';

const CUSTOM_CHAPTERS_STORAGE_KEY = 'voz-e-folha-custom-fables-v1';
const THEME_STORAGE_KEY = 'voz-e-folha-theme-v1';
const BOOKMARK_STORAGE_KEY = 'voz-e-folha-bookmark-fables-v1';
const CURATOR_MODE_STORAGE_KEY = 'voz-e-folha-curator-mode-v1';
const PLAYBACK_RATES = [0.9, 1, 1.15, 1.3];

interface ReadingBookmark {
  bookId: string;
  chapterId: string;
}

function toChapterSummary(chapter: Chapter): ChapterSummary {
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

function toBookCatalogItem(book: Book): BookCatalogItem {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    year: book.year,
    publicDomainSource: book.publicDomainSource,
    coverUrl: book.coverUrl,
    synopsis: book.synopsis,
    chapters: book.chapters.map(toChapterSummary),
  };
}

function loadCustomChapters(): Chapter[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_CHAPTERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Chapter[]) : [];
  } catch {
    return [];
  }
}

function loadReadingBookmark(): ReadingBookmark {
  const fallback: ReadingBookmark = {
    bookId: PUBLIC_DOMAIN_BOOKS[0].id,
    chapterId: PUBLIC_DOMAIN_BOOKS[0].chapters[0].id,
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(BOOKMARK_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ReadingBookmark>;
    if (typeof parsed.bookId === 'string' && typeof parsed.chapterId === 'string') {
      return { bookId: parsed.bookId, chapterId: parsed.chapterId };
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function buildInitialChapterMap(customChapters: Chapter[]): Record<string, Chapter> {
  const map: Record<string, Chapter> = {};
  for (const book of PUBLIC_DOMAIN_BOOKS) {
    for (const ch of book.chapters) {
      map[ch.id] = ch;
    }
  }
  for (const ch of customChapters) {
    map[ch.id] = ch;
  }
  return map;
}

function buildDefaultVoiceMap(chapter: Chapter | null): Record<string, PrebuiltVoiceName> {
  if (!chapter) return {};
  const map: Record<string, PrebuiltVoiceName> = {};
  for (const ch of chapter.characters) {
    map[ch.name] = ch.defaultVoice;
  }
  return map;
}

export default function App() {
  const [customChapters, setCustomChapters] = useState<Chapter[]>(() => loadCustomChapters());
  const [serverCatalog, setServerCatalog] = useState<BookCatalogItem[]>(() =>
    PUBLIC_DOMAIN_BOOKS.map(toBookCatalogItem),
  );
  const [loadedChapters, setLoadedChapters] = useState<Record<string, Chapter>>(() =>
    buildInitialChapterMap(loadCustomChapters()),
  );

  const initialBookmark = useMemo(() => loadReadingBookmark(), []);
  const [selectedBookId, setSelectedBookId] = useState<string>(initialBookmark.bookId);
  const [selectedChapterId, setSelectedChapterId] = useState<string>(initialBookmark.chapterId);
  const [isDramatizing, setIsDramatizing] = useState<boolean>(false);

  const [mode, setMode] = useState<ReadingMode>('dramatized');
  const [voiceOverrides, setVoiceOverrides] = useState<
    Record<string, Record<string, PrebuiltVoiceName>>
  >({});

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
  });

  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [addBookOpen, setAddBookOpen] = useState(false);
  const [voicesOpen, setVoicesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [localCacheInventory, setLocalCacheInventory] = useState<CacheInventoryResponse>(() =>
    getStaticCacheInventory(),
  );
  const [firestoreItems, setFirestoreItems] = useState<CachedAudioMetadata[]>([]);
  const [cloudCustomBooks, setCloudCustomBooks] = useState<Book[]>([]);
  const [cloudScripts, setCloudScripts] = useState<Record<string, DramatizedScriptRecord>>({});
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [curatorMode, setCuratorMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(CURATOR_MODE_STORAGE_KEY) === 'true';
  });
  const [dbSyncLabel, setDbSyncLabel] = useState<string | null>(null);

  const isAdmin = useMemo(() => isAdminUser(authUser), [authUser]);
  const isCuratorMode = isAdmin && curatorMode;

  const handleToggleCuratorMode = useCallback(() => {
    if (!isAdmin) return;
    setCuratorMode((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(CURATOR_MODE_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, [isAdmin]);

  // Playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeBlobUrlRef = useRef<string | null>(null);
  const browserSpeechRef = useRef<BrowserSpeechReader | null>(null);

  const [loadedAudioMeta, setLoadedAudioMeta] = useState<CachedAudioMetadata | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRateIndex, setPlaybackRateIndex] = useState(1);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState<boolean>(false);

  // Local Web Speech fallback state
  const browserSpeechSupported = useMemo(() => isBrowserSpeechSupported(), []);
  const [isLocalSpeechActive, setIsLocalSpeechActive] = useState(false);
  const [isLocalSpeechPlaying, setIsLocalSpeechPlaying] = useState(false);
  const [localSpeechTurnIndex, setLocalSpeechTurnIndex] = useState(-1);

  // Client-side Curator batch queue state (Vercel serverless compatible)
  const [ttsStatus, setTtsStatus] = useState<TtsStatusResponse>({
    activeJob: null,
    queue: [],
    pacingSec: 4,
    dailyQuotaPaused: false,
  });
  const queueTasksRef = useRef<Array<{ item: TtsQueueItem; bookId: string; bookTitle: string }>>([]);
  const queueRunningRef = useRef(false);
  const queueCancelGenRef = useRef(0);
  const pacingSecRef = useRef(4);
  const dailyQuotaPausedRef = useRef(false);
  const dailyQuotaMessageRef = useRef<string | undefined>(undefined);

  const playbackRate = PLAYBACK_RATES[playbackRateIndex];

  // Merge server catalog, Firestore custom collections, local custom fables, and cloud scripts
  const books: BookCatalogItem[] = useMemo(() => {
    const baseById = new Map<string, BookCatalogItem>();
    for (const book of serverCatalog) {
      baseById.set(book.id, book);
    }
    for (const cloudBook of cloudCustomBooks) {
      if (!baseById.has(cloudBook.id)) {
        baseById.set(cloudBook.id, toBookCatalogItem(cloudBook));
      }
    }

    return Array.from(baseById.values()).map((book) => {
      const extras = customChapters.filter((c) => c.bookId === book.id).map(toChapterSummary);
      const allChapters = (extras.length === 0 ? book.chapters : [...book.chapters, ...extras]).map(
        (ch) => {
          const script = cloudScripts[ch.id];
          if (!script) return ch;
          return {
            ...ch,
            characterCount: script.characters.length,
            moral: script.moral || ch.moral,
            aiNotes: script.aiNotes || ch.aiNotes,
            dramatizedByAi: true,
          };
        },
      );
      return { ...book, chapters: allChapters };
    });
  }, [cloudCustomBooks, cloudScripts, customChapters, serverCatalog]);

  const currentBook = useMemo(
    () => books.find((b) => b.id === selectedBookId) ?? books[0],
    [books, selectedBookId],
  );

  const currentChapterIndex = useMemo(() => {
    const idx = currentBook.chapters.findIndex((c) => c.id === selectedChapterId);
    return idx >= 0 ? idx : 0;
  }, [currentBook, selectedChapterId]);

  const currentChapterSummary =
    currentBook.chapters[currentChapterIndex] ?? currentBook.chapters[0];

  const currentChapter: Chapter | null = useMemo(() => {
    const base = loadedChapters[selectedChapterId];
    if (!base) return null;
    const script = cloudScripts[base.id];
    if (!script) return base;
    return {
      ...base,
      summary: script.summary || base.summary,
      moral: script.moral || base.moral,
      aiNotes: script.aiNotes || base.aiNotes,
      characters: script.characters,
      turns: script.turns,
      characterCount: script.characters.length,
      dramatizedByAi: true,
    };
  }, [cloudScripts, loadedChapters, selectedChapterId]);

  const isLoadingChapter = !currentChapter;

  const currentVoiceMap = useMemo(() => {
    const defaults = buildDefaultVoiceMap(currentChapter);
    if (!currentChapter) return defaults;
    return { ...defaults, ...(voiceOverrides[currentChapter.id] ?? {}) };
  }, [currentChapter, voiceOverrides]);

  const currentCacheKey = useMemo(() => {
    if (!currentChapter) return '';
    return computeChapterCacheKey({
      chapterId: currentChapter.id,
      mode,
      turns: currentChapter.turns,
      voiceMap: currentVoiceMap,
    });
  }, [currentChapter, mode, currentVoiceMap]);

  const firestoreKeys = useMemo(
    () => new Set(firestoreItems.map((item) => item.cacheKey)),
    [firestoreItems],
  );

  const cacheInventory: CacheInventoryResponse = useMemo(() => {
    const map = new Map<string, CachedAudioMetadata & { exists: boolean }>();
    for (const item of localCacheInventory.items) {
      map.set(item.cacheKey, {
        ...item,
        storageSource: item.audioUrl.startsWith('/audio-cache/') ? 'static' : 'local-server',
        exists: true,
      });
    }
    // Firestore/Storage records take precedence as the persistent cloud source of truth
    for (const dbItem of firestoreItems) {
      map.set(dbItem.cacheKey, {
        ...dbItem,
        storageSource: dbItem.storageSource ?? 'firestore',
        exists: true,
      });
    }
    const items = Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const totalSizeBytes = items.reduce((acc, item) => acc + item.fileSizeBytes, 0);
    return { items, totalSizeBytes, count: items.length };
  }, [firestoreItems, localCacheInventory.items]);

  const serverCachedMeta = useMemo(() => {
    if (!currentCacheKey) return null;
    return (
      cacheInventory.items.find((item) => item.cacheKey === currentCacheKey) ??
      STATIC_PRERENDERED_AUDIOS[currentCacheKey] ??
      null
    );
  }, [cacheInventory.items, currentCacheKey]);

  const cachedChapterIds = useMemo(() => {
    const set = new Set<string>();
    for (const item of Object.values(STATIC_PRERENDERED_AUDIOS)) {
      set.add(item.chapterId);
    }
    for (const item of cacheInventory.items) {
      set.add(item.chapterId);
    }
    return set;
  }, [cacheInventory.items]);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    } else {
      root.classList.remove('dark');
      window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    }
  }, [darkMode]);

  // Persist reading bookmark
  useEffect(() => {
    try {
      window.localStorage.setItem(
        BOOKMARK_STORAGE_KEY,
        JSON.stringify({ bookId: selectedBookId, chapterId: selectedChapterId }),
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [selectedBookId, selectedChapterId]);

  // Persist custom chapters
  useEffect(() => {
    try {
      window.localStorage.setItem(CUSTOM_CHAPTERS_STORAGE_KEY, JSON.stringify(customChapters));
    } catch {
      // Ignore storage quota errors
    }
  }, [customChapters]);

  // Track Firebase Google Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe in real time to public pre-rendered audio, custom collections, and scripts in Firestore
  useEffect(() => {
    const unsubAudio = subscribeToPrerenderedAudios(
      (items) => {
        setFirestoreItems(items);
      },
      (err) => {
        console.warn('Firestore prerenderedAudios listener notice:', err.message);
      },
    );
    const unsubBooks = subscribeToCustomBooks(
      (cloudBooks) => {
        setCloudCustomBooks(cloudBooks);
        setLoadedChapters((prev) => {
          const next = { ...prev };
          for (const b of cloudBooks) {
            for (const ch of b.chapters) {
              if (!next[ch.id]) {
                next[ch.id] = ch;
              }
            }
          }
          return next;
        });
      },
      (err) => {
        console.warn('Firestore customBooks listener notice:', err.message);
      },
    );
    const unsubScripts = subscribeToDramatizedScripts(
      (scripts) => {
        setCloudScripts(scripts);
      },
      (err) => {
        console.warn('Firestore dramatizedScripts listener notice:', err.message);
      },
    );
    return () => {
      unsubAudio();
      unsubBooks();
      unsubScripts();
    };
  }, []);

  // Hydrate fables & fairy tales catalog + WAV cache inventory on mount
  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      try {
        const res = await fetch('/api/books');
        if (!res.ok) return;
        const data = await safeParseJson<{
          books?: BookCatalogItem[];
          cache?: CacheInventoryResponse;
        }>(res);
        if (cancelled) return;
        if (Array.isArray(data.books) && data.books.length > 0) {
          setServerCatalog(data.books);
        }
        if (data.cache) {
          setLocalCacheInventory(mergeWithStaticCacheInventory(data.cache));
        }
      } catch {
        // Non-fatal: falls back to seed fables and static pre-rendered WAV catalog
      }
    }
    void loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lazily fetch chapter text whenever user navigates to a chapter not yet in memory
  useEffect(() => {
    if (loadedChapters[selectedChapterId]) {
      return;
    }

    let cancelled = false;

    async function fetchChapter() {
      try {
        const res = await fetch(
          `/api/books/${encodeURIComponent(selectedBookId)}/chapters/${encodeURIComponent(selectedChapterId)}`,
        );
        if (!res.ok) {
          throw new Error('Fábula ou conto não encontrado na biblioteca.');
        }
        const data = await safeParseJson<{ chapter: Chapter }>(res);
        if (cancelled || !data.chapter) return;
        setLoadedChapters((prev) => ({ ...prev, [data.chapter.id]: data.chapter }));
      } catch {
        if (cancelled) return;
        const fallbackBook = PUBLIC_DOMAIN_BOOKS[0];
        setSelectedBookId(fallbackBook.id);
        setSelectedChapterId(fallbackBook.chapters[0].id);
      }
    }

    void fetchChapter();
    return () => {
      cancelled = true;
    };
  }, [loadedChapters, selectedBookId, selectedChapterId]);

  const refreshCacheInventory = useCallback(async () => {
    try {
      const res = await fetch('/api/cache');
      if (res.ok) {
        const data = await safeParseJson<CacheInventoryResponse>(res);
        setLocalCacheInventory(mergeWithStaticCacheInventory(data));
      }
    } catch {
      // Non-fatal on initial load
    }
  }, []);

  const stopLocalSpeech = useCallback(() => {
    browserSpeechRef.current?.stop();
    setIsLocalSpeechActive(false);
    setIsLocalSpeechPlaying(false);
    setLocalSpeechTurnIndex(-1);
  }, []);

  useEffect(() => {
    const reader = new BrowserSpeechReader({
      onTurnChange: (idx) => setLocalSpeechTurnIndex(idx),
      onStateChange: (playing) => setIsLocalSpeechPlaying(playing),
      onEnd: () => {
        setIsLocalSpeechActive(false);
        setIsLocalSpeechPlaying(false);
        setLocalSpeechTurnIndex(-1);
      },
      onError: (msg) => {
        setIsLocalSpeechActive(false);
        setIsLocalSpeechPlaying(false);
        setErrorMessage(msg);
        setIsQuotaError(false);
      },
    });
    browserSpeechRef.current = reader;
    return () => {
      reader.stop();
    };
  }, []);

  const resetAudioElement = useCallback(() => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    if (activeBlobUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
      activeBlobUrlRef.current = null;
    }
    setLoadedAudioMeta(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  useEffect(() => {
    return () => {
      if (activeBlobUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }
    };
  }, []);

  const prevPlaybackRateRef = useRef(playbackRate);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
    if (prevPlaybackRateRef.current !== playbackRate) {
      prevPlaybackRateRef.current = playbackRate;
      if (isLocalSpeechActive) {
        browserSpeechRef.current?.setRate(playbackRate);
      }
    }
  }, [isLocalSpeechActive, playbackRate]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const handleTimeUpdate = () => setCurrentTime(el.currentTime);
    const handleLoadedMetadata = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) {
        setDuration(el.duration);
      }
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(el.duration || 0);
    };

    el.addEventListener('timeupdate', handleTimeUpdate);
    el.addEventListener('loadedmetadata', handleLoadedMetadata);
    el.addEventListener('play', handlePlay);
    el.addEventListener('pause', handlePause);
    el.addEventListener('ended', handleEnded);

    return () => {
      el.removeEventListener('timeupdate', handleTimeUpdate);
      el.removeEventListener('loadedmetadata', handleLoadedMetadata);
      el.removeEventListener('play', handlePlay);
      el.removeEventListener('pause', handlePause);
      el.removeEventListener('ended', handleEnded);
    };
  }, []);

  const loadAndPlayMetadata = useCallback(
    async (meta: CachedAudioMetadata, autoPlay: boolean, notice?: string) => {
      const { blobUrl, fromBrowserCache } = await getPlayableAudioBlobUrl(
        meta.audioUrl,
        meta.mimeType,
      );
      if (activeBlobUrlRef.current?.startsWith('blob:')) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }
      activeBlobUrlRef.current = blobUrl;
      setLoadedAudioMeta(meta);
      setDuration(meta.durationSec);
      setCurrentTime(0);

      const el = audioRef.current;
      if (el) {
        el.src = blobUrl;
        el.playbackRate = playbackRate;
        el.load();
        if (autoPlay) {
          try {
            await el.play();
          } catch {
            // Browser autoplay policy may require explicit tap; controls remain ready
          }
        }
      }

      if (notice) {
        setStatusNotice(notice);
      } else if (fromBrowserCache) {
        setStatusNotice('Áudio carregado instantaneamente do cache local.');
      }
    },
    [playbackRate],
  );

  const handleStartLocalSpeech = useCallback(
    (startIndex = 0) => {
      if (!currentChapter || !browserSpeechSupported) return;
      resetAudioElement();
      setErrorMessage(null);
      setIsQuotaError(false);
      setVoicesOpen(false);
      setIsLocalSpeechActive(true);
      setLocalSpeechTurnIndex(startIndex);
      browserSpeechRef.current?.start(currentChapter.turns, mode, playbackRate, startIndex);
      setStatusNotice('Contando a história com voz local do dispositivo (sem consumo de cota).');
    },
    [browserSpeechSupported, currentChapter, mode, playbackRate, resetAudioElement],
  );

  const handleToggleLocalSpeech = useCallback(() => {
    if (isLocalSpeechActive) {
      stopLocalSpeech();
      setStatusNotice('Leitura por voz local encerrada.');
    } else {
      handleStartLocalSpeech(0);
    }
  }, [handleStartLocalSpeech, isLocalSpeechActive, stopLocalSpeech]);

  const handleSynthesizeOrPlay = useCallback(
    async (forceRegenerate = false) => {
      if (!currentChapter || isLoadingChapter) return;
      stopLocalSpeech();
      setErrorMessage(null);
      setIsQuotaError(false);
      setStatusNotice(null);

      if (!forceRegenerate && loadedAudioMeta?.cacheKey === currentCacheKey && audioRef.current) {
        if (audioRef.current.paused) {
          try {
            await audioRef.current.play();
          } catch {
            // Ignore autoplay restriction
          }
        } else {
          audioRef.current.pause();
        }
        return;
      }

      if (!forceRegenerate && serverCachedMeta) {
        await loadAndPlayMetadata(
          serverCachedMeta,
          true,
          isCuratorMode
            ? 'Reproduzindo fábula pré-renderizada — zero espera.'
            : 'Reproduzindo história com áudio pronto.',
        );
        return;
      }

      if (!forceRegenerate && (!authUser || !authUser.emailVerified)) {
        if (browserSpeechSupported) {
          handleStartLocalSpeech(0);
          setStatusNotice(
            'Lendo com a voz do dispositivo. Entre com Google em Vozes para gerar a versão dramatizada.',
          );
          return;
        }
        setErrorMessage(
          'Entre com sua conta Google verificada em Vozes para gerar a narração dramatizada desta história.',
        );
        return;
      }

      if (forceRegenerate && !isAdmin) {
        setErrorMessage('Apenas o administrador curador pode regerar áudios.');
        return;
      }

      setIsSynthesizing(true);
      try {
        const response = await authFetch('/api/chapters/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chapterId: currentChapter.id,
            bookTitle: currentBook.title,
            chapterTitle: `${currentChapter.numberLabel} — ${currentChapter.title}`,
            mode,
            turns: currentChapter.turns,
            voiceMap: currentVoiceMap,
            forceRegenerate,
          }),
        });

        const data = await safeParseJson<
          SynthesizeResponse & {
            error?: string;
            isQuotaError?: boolean;
          }
        >(response, 'Não foi possível pré-renderizar o áudio desta história.');
        if (!response.ok) {
          const quotaFlag =
            Boolean(data.isQuotaError) ||
            response.status === 429 ||
            /cota|limite|requisiç/i.test(data.error ?? '');
          setIsQuotaError(quotaFlag);
          throw new Error(data.error || 'Não foi possível pré-renderizar o áudio desta história.');
        }

        if (forceRegenerate) {
          await evictBrowserAudioCache(data.audioUrl);
        }

        await refreshCacheInventory();

        let savedMeta: CachedAudioMetadata = data;
        let noticeMessage = data.cached
          ? 'Reproduzindo história com áudio pronto.'
          : 'Áudio MP3 gerado e salvo em cache para próximas audições.';

        // Automatically upload newly synthesized MP3 to Firebase Storage + Firestore when signed in
        if (authUser && authUser.emailVerified && (!firestoreKeys.has(data.cacheKey) || forceRegenerate)) {
          try {
            setDbSyncLabel(`Salvando "${currentChapter.title}" na nuvem…`);
            const audioBytes = await fetchAudioBytesForStorage(data.audioUrl);
            savedMeta = await savePrerenderedAudioToFirestore({
              meta: data,
              bookId: currentBook.id,
              wavBytes: audioBytes,
              user: authUser,
              onProgress: (done) => {
                setDbSyncLabel(`Enviando para a nuvem (${done}%)…`);
              },
            });
            noticeMessage = 'Áudio MP3 gerado e salvo no Firestore!';
          } catch (dbErr) {
            console.warn('Auto-save to cloud skipped:', dbErr);
          } finally {
            setDbSyncLabel(null);
          }
        }

        await loadAndPlayMetadata(savedMeta, true, noticeMessage);
      } catch (err) {
        if (!forceRegenerate && browserSpeechSupported) {
          handleStartLocalSpeech(0);
          setStatusNotice(
            'Reproduzindo com voz local do dispositivo (geração em nuvem indisponível no momento).',
          );
        } else {
          setErrorMessage(
            err instanceof Error ? err.message : 'Erro inesperado ao interpretar a história.',
          );
        }
      } finally {
        setIsSynthesizing(false);
      }
    },
    [
      authUser,
      browserSpeechSupported,
      currentBook.id,
      currentBook.title,
      currentCacheKey,
      currentChapter,
      currentVoiceMap,
      firestoreKeys,
      handleStartLocalSpeech,
      isAdmin,
      isCuratorMode,
      isLoadingChapter,
      loadAndPlayMetadata,
      loadedAudioMeta?.cacheKey,
      mode,
      refreshCacheInventory,
      serverCachedMeta,
      stopLocalSpeech,
    ],
  );

  const handleDramatizeChapter = useCallback(async () => {
    if (!currentChapter || isDramatizing) return;
    setErrorMessage(null);
    setStatusNotice(null);
    setIsDramatizing(true);

    try {
      const response = await authFetch(
        `/api/chapters/${encodeURIComponent(currentChapter.id)}/dramatize`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId: currentBook.id }),
        },
      );
      const data = await safeParseJson<{
        chapter?: Chapter;
        cached?: boolean;
        error?: string;
      }>(response, 'Não foi possível pré-ajustar o elenco de vozes.');
      if (!response.ok || !data.chapter) {
        throw new Error(data.error || 'Não foi possível pré-ajustar o elenco de vozes.');
      }

      const refined = data.chapter;
      setLoadedChapters((prev) => ({ ...prev, [refined.id]: refined }));
      setServerCatalog((prev) =>
        prev.map((book) =>
          book.id !== refined.bookId
            ? book
            : {
                ...book,
                chapters: book.chapters.map((ch) =>
                  ch.id === refined.id
                    ? {
                        ...ch,
                        characterCount: refined.characters.length,
                        moral: refined.moral,
                        aiNotes: refined.aiNotes,
                        dramatizedByAi: true,
                      }
                    : ch,
                ),
              },
        ),
      );
      if (authUser?.emailVerified) {
        try {
          await saveDramatizedScriptToFirestore(refined, authUser);
        } catch (dbErr) {
          console.warn('Save dramatized script to Firestore skipped:', dbErr);
        }
      }
      setStatusNotice(
        data.cached
          ? 'Roteiro pré-ajustado recuperado do cache.'
          : `Roteiro pré-ajustado com IA (${refined.characters.length} vozes e moral) e salvo na nuvem.`,
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Não foi possível pré-ajustar esta história.',
      );
    } finally {
      setIsDramatizing(false);
    }
  }, [authUser, currentBook.id, currentChapter, isDramatizing]);

  useEffect(() => {
    if (!statusNotice) return;
    const timer = window.setTimeout(() => setStatusNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [statusNotice]);

  const handleTogglePlayPause = useCallback(async () => {
    if (isLocalSpeechActive) {
      browserSpeechRef.current?.togglePause();
      return;
    }
    const el = audioRef.current;
    if (!el || !loadedAudioMeta) return;
    if (el.paused) {
      if (el.ended) el.currentTime = 0;
      try {
        await el.play();
      } catch {
        // Ignore
      }
    } else {
      el.pause();
    }
  }, [isLocalSpeechActive, loadedAudioMeta]);

  const handleSeek = useCallback((seconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(seconds, el.duration || seconds));
    el.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const handleSkip = useCallback(
    (deltaSec: number) => {
      const el = audioRef.current;
      if (!el) return;
      handleSeek(el.currentTime + deltaSec);
    },
    [handleSeek],
  );

  const handleSkipLocalTurn = useCallback((delta: number) => {
    browserSpeechRef.current?.skipTurn(delta);
  }, []);

  const handleCycleSpeed = useCallback(() => {
    setPlaybackRateIndex((prev) => (prev + 1) % PLAYBACK_RATES.length);
  }, []);

  const activeSegments: AudioSegmentTiming[] = useMemo(
    () => loadedAudioMeta?.segments ?? serverCachedMeta?.segments ?? [],
    [loadedAudioMeta?.segments, serverCachedMeta?.segments],
  );

  const activeTurnIndex = useMemo(() => {
    if (isLocalSpeechActive) return localSpeechTurnIndex;
    if (!loadedAudioMeta || activeSegments.length === 0) return -1;
    if (!isPlaying && currentTime === 0) return -1;
    return findActiveSegmentIndex(activeSegments, currentTime);
  }, [
    activeSegments,
    currentTime,
    isLocalSpeechActive,
    isPlaying,
    loadedAudioMeta,
    localSpeechTurnIndex,
  ]);

  const handleSeekToTurn = useCallback(
    async (turnIndex: number) => {
      if (isLocalSpeechActive) {
        browserSpeechRef.current?.seekToTurn(turnIndex);
        return;
      }

      const seg = activeSegments[turnIndex];
      if (!seg) return;

      if (!loadedAudioMeta && serverCachedMeta) {
        await loadAndPlayMetadata(serverCachedMeta, false);
      }

      const el = audioRef.current;
      if (el) {
        el.currentTime = seg.startSec;
        setCurrentTime(seg.startSec);
        try {
          await el.play();
        } catch {
          // Ignore autoplay restriction
        }
      }
    },
    [activeSegments, isLocalSpeechActive, loadAndPlayMetadata, loadedAudioMeta, serverCachedMeta],
  );

  const handleSelectChapter = useCallback(
    (bookId: string, chapterId: string) => {
      stopLocalSpeech();
      resetAudioElement();
      setErrorMessage(null);
      setIsQuotaError(false);
      setSelectedBookId(bookId);
      setSelectedChapterId(chapterId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [resetAudioElement, stopLocalSpeech],
  );

  const remainingUncachedChapters = useMemo(() => {
    return currentBook.chapters.filter((ch) => !ch.isCustom && !cachedChapterIds.has(ch.id));
  }, [cachedChapterIds, currentBook.chapters]);

  const authUserRef = useRef(authUser);
  const loadedChaptersRef = useRef(loadedChapters);
  const cloudScriptsRef = useRef(cloudScripts);
  const voiceOverridesRef = useRef(voiceOverrides);
  const cachedChapterIdsRef = useRef(cachedChapterIds);
  const firestoreKeysRef = useRef(firestoreKeys);

  useEffect(() => {
    authUserRef.current = authUser;
    loadedChaptersRef.current = loadedChapters;
    cloudScriptsRef.current = cloudScripts;
    voiceOverridesRef.current = voiceOverrides;
    cachedChapterIdsRef.current = cachedChapterIds;
    firestoreKeysRef.current = firestoreKeys;
  }, [authUser, loadedChapters, cloudScripts, voiceOverrides, cachedChapterIds, firestoreKeys]);

  const syncQueueStatus = useCallback(
    (activeJob: TtsStatusResponse['activeJob']) => {
      setTtsStatus({
        activeJob,
        queue: queueTasksRef.current.map((t) => ({ ...t.item })),
        pacingSec: pacingSecRef.current,
        dailyQuotaPaused: dailyQuotaPausedRef.current,
        dailyQuotaMessage: dailyQuotaMessageRef.current,
      });
    },
    [],
  );

  const runClientQueueWorker = useCallback(async () => {
    if (queueRunningRef.current) return;
    queueRunningRef.current = true;
    const myGen = queueCancelGenRef.current;

    try {
      while (myGen === queueCancelGenRef.current) {
        if (dailyQuotaPausedRef.current) break;
        const nextTask = queueTasksRef.current.find((t) => t.item.status === 'queued');
        if (!nextTask) break;

        if (cachedChapterIdsRef.current.has(nextTask.item.chapterId)) {
          nextTask.item.status = 'done';
          syncQueueStatus(null);
          continue;
        }

        nextTask.item.status = 'running';
        let chapterObj: Chapter | undefined = loadedChaptersRef.current[nextTask.item.chapterId];
        if (!chapterObj) {
          try {
            const res = await fetch(
              `/api/books/${encodeURIComponent(nextTask.bookId)}/chapters/${encodeURIComponent(nextTask.item.chapterId)}`,
            );
            if (res.ok) {
              const data = await safeParseJson<{ chapter?: Chapter }>(res);
              if (data.chapter) {
                chapterObj = data.chapter;
                setLoadedChapters((prev) => ({ ...prev, [data.chapter!.id]: data.chapter! }));
              }
            }
          } catch {
            // Handled below
          }
        }

        if (!chapterObj) {
          nextTask.item.status = 'failed';
          nextTask.item.error = 'Não foi possível carregar o texto da história.';
          syncQueueStatus(null);
          continue;
        }

        const scriptOverlay = cloudScriptsRef.current[chapterObj.id];
        if (scriptOverlay) {
          chapterObj = {
            ...chapterObj,
            characters: scriptOverlay.characters,
            turns: scriptOverlay.turns,
          };
        }

        const voiceMap = {
          ...buildDefaultVoiceMap(chapterObj),
          ...(voiceOverridesRef.current[chapterObj.id] ?? {}),
        };
        const cacheKey = computeChapterCacheKey({
          chapterId: chapterObj.id,
          mode: nextTask.item.mode,
          turns: chapterObj.turns,
          voiceMap,
        });

        syncQueueStatus({
          chapterId: chapterObj.id,
          chapterTitle: nextTask.item.chapterTitle,
          cacheKey,
          source: 'queue',
          state: 'synthesizing',
          completedBatches: 0,
          totalBatches: Math.max(1, chapterObj.turns.length),
          reusedBatches: 0,
        });

        try {
          const response = await authFetch('/api/chapters/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chapterId: chapterObj.id,
              bookTitle: nextTask.bookTitle,
              chapterTitle: nextTask.item.chapterTitle,
              mode: nextTask.item.mode,
              turns: chapterObj.turns,
              voiceMap,
            }),
          });
          const data = await safeParseJson<
            SynthesizeResponse & { error?: string; isQuotaError?: boolean }
          >(response, 'Falha ao pré-renderizar história na fila.');

          if (!response.ok) {
            const errMsg = data.error || 'Falha ao pré-renderizar história na fila.';
            const quotaHit =
              Boolean(data.isQuotaError) ||
              response.status === 429 ||
              isDailyQuotaError(errMsg);
            nextTask.item.status = 'failed';
            nextTask.item.error = errMsg;
            if (quotaHit) {
              dailyQuotaPausedRef.current = true;
              dailyQuotaMessageRef.current = errMsg;
            }
            syncQueueStatus(null);
            if (quotaHit) break;
            continue;
          }

          await refreshCacheInventory();
          const signedUser = authUserRef.current;
          if (signedUser?.emailVerified && !firestoreKeysRef.current.has(data.cacheKey)) {
            try {
              const bytes = await fetchAudioBytesForStorage(data.audioUrl);
              await savePrerenderedAudioToFirestore({
                meta: data,
                bookId: nextTask.bookId,
                wavBytes: bytes,
                user: signedUser,
              });
            } catch (dbErr) {
              console.warn('Batch queue cloud upload skipped:', dbErr);
            }
          }

          nextTask.item.status = 'done';
          syncQueueStatus(null);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Falha na síntese da fila.';
          nextTask.item.status = 'failed';
          nextTask.item.error = errMsg;
          syncQueueStatus(null);
        }

        const hasMore = queueTasksRef.current.some((t) => t.item.status === 'queued');
        if (hasMore && !dailyQuotaPausedRef.current && myGen === queueCancelGenRef.current) {
          await new Promise<void>((resolve) =>
            window.setTimeout(resolve, pacingSecRef.current * 1000),
          );
        }
      }
    } finally {
      queueRunningRef.current = false;
      syncQueueStatus(null);
    }
  }, [refreshCacheInventory, syncQueueStatus]);

  const handleEnqueueChaptersForBook = useCallback(
    async (bookId: string, maxCount = 6) => {
      if (!authUser?.emailVerified) {
        setErrorMessage('Entre com sua conta Google de curador para pré-renderizar em lote.');
        return;
      }
      const targetBook = books.find((b) => b.id === bookId) ?? currentBook;
      const targetChapters = targetBook.chapters
        .filter((ch) => !ch.isCustom && !cachedChapterIds.has(ch.id))
        .slice(0, maxCount);

      if (targetChapters.length === 0) {
        setStatusNotice('Todas as histórias desta coleção já estão com áudio pronto.');
        return;
      }

      dailyQuotaPausedRef.current = false;
      dailyQuotaMessageRef.current = undefined;

      // Trim finished items if list gets long
      while (queueTasksRef.current.length > 25) {
        const idx = queueTasksRef.current.findIndex(
          (t) => t.item.status === 'done' || t.item.status === 'failed',
        );
        if (idx >= 0) {
          queueTasksRef.current.splice(idx, 1);
        } else {
          break;
        }
      }

      let added = 0;
      for (const ch of targetChapters) {
        const alreadyInQueue = queueTasksRef.current.some(
          (t) =>
            t.item.chapterId === ch.id &&
            t.item.mode === mode &&
            (t.item.status === 'queued' || t.item.status === 'running'),
        );
        if (alreadyInQueue) continue;

        queueTasksRef.current.push({
          item: {
            id: `${ch.id}-${Date.now().toString(36).slice(-4)}`,
            bookId: targetBook.id,
            chapterId: ch.id,
            chapterTitle: `${ch.numberLabel} — ${ch.title}`,
            mode,
            status: 'queued',
          },
          bookId: targetBook.id,
          bookTitle: targetBook.title,
        });
        added += 1;
      }

      syncQueueStatus(null);

      if (added > 0) {
        setStatusNotice(
          `${added} ${added === 1 ? 'história adicionada' : 'histórias adicionadas'} à fila de pré-renderização (.mp3).`,
        );
        void runClientQueueWorker();
      } else {
        setStatusNotice('Estas histórias já estavam na fila ou prontas.');
      }
    },
    [authUser, books, cachedChapterIds, currentBook, mode, runClientQueueWorker, syncQueueStatus],
  );

  const handleEnqueueNextChapters = useCallback(
    async (count: number) => {
      await handleEnqueueChaptersForBook(currentBook.id, count);
    },
    [currentBook.id, handleEnqueueChaptersForBook],
  );

  const handleSetPacingSec = useCallback(
    (seconds: number) => {
      const clamped = Math.max(1, Math.min(30, Math.round(seconds)));
      pacingSecRef.current = clamped;
      syncQueueStatus(ttsStatus.activeJob);
    },
    [syncQueueStatus, ttsStatus.activeJob],
  );

  const handleClearQueue = useCallback(() => {
    queueCancelGenRef.current += 1;
    queueTasksRef.current = queueTasksRef.current.filter((t) => t.item.status === 'running');
    dailyQuotaPausedRef.current = false;
    dailyQuotaMessageRef.current = undefined;
    syncQueueStatus(null);
    setStatusNotice('Fila de pré-renderização limpa.');
  }, [syncQueueStatus]);

  const handleModeChange = useCallback(
    (nextMode: ReadingMode) => {
      if (nextMode === mode) return;
      stopLocalSpeech();
      resetAudioElement();
      setMode(nextMode);
    },
    [mode, resetAudioElement, stopLocalSpeech],
  );

  const handleVoiceChange = useCallback(
    (speaker: string, voice: PrebuiltVoiceName) => {
      if (!currentChapter) return;
      stopLocalSpeech();
      resetAudioElement();
      setVoiceOverrides((prev) => ({
        ...prev,
        [currentChapter.id]: {
          ...(prev[currentChapter.id] ?? {}),
          [speaker]: voice,
        },
      }));
    },
    [currentChapter, resetAudioElement, stopLocalSpeech],
  );

  const resolveBookIdForChapter = useCallback(
    (chapterId: string): string => {
      for (const b of books) {
        if (b.chapters.some((c) => c.id === chapterId)) return b.id;
      }
      return currentBook.id;
    },
    [books, currentBook.id],
  );

  const handleSignInGoogle = useCallback(async () => {
    setErrorMessage(null);
    setIsSigningIn(true);
    try {
      const user = await signInWithGoogle();
      setStatusNotice(`Conectado como ${user.displayName || 'usuário Google'}. Banco Firestore pronto para gravação.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        setErrorMessage('Não foi possível entrar com o Google. Verifique se pop-ups estão permitidos.');
      }
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const handleSignOutGoogle = useCallback(async () => {
    try {
      await signOutUser();
      setStatusNotice('Sessão Google encerrada.');
    } catch {
      setErrorMessage('Não foi possível encerrar a sessão.');
    }
  }, []);

  const handleSaveItemToFirestore = useCallback(
    async (item: CachedAudioMetadata) => {
      if (!authUser) {
        setErrorMessage('Entre com sua conta Google para salvar pré-renderizados na nuvem.');
        return;
      }
      setErrorMessage(null);
      setDbSyncLabel(`Preparando "${item.chapterTitle}"…`);
      try {
        const audioBytes = await fetchAudioBytesForStorage(item.audioUrl);
        await savePrerenderedAudioToFirestore({
          meta: item,
          bookId: item.bookId || resolveBookIdForChapter(item.chapterId),
          wavBytes: audioBytes,
          user: authUser,
          onProgress: (done) => {
            setDbSyncLabel(`Enviando "${item.chapterTitle}" (${done}%)…`);
          },
        });
        setStatusNotice(`"${item.chapterTitle}" salvo permanentemente no Firestore!`);
      } catch (err) {
        setErrorMessage(formatFriendlyFirestoreError(err));
      } finally {
        setDbSyncLabel(null);
      }
    },
    [authUser, resolveBookIdForChapter],
  );

  const handleSyncAllToFirestore = useCallback(async () => {
    if (!authUser) {
      setErrorMessage('Entre com sua conta Google para sincronizar os áudios na nuvem.');
      return;
    }
    const pending = cacheInventory.items.filter((item) => !firestoreKeys.has(item.cacheKey));
    if (pending.length === 0) {
      setStatusNotice('Todos os áudios pré-renderizados já estão salvos na nuvem.');
      return;
    }
    setErrorMessage(null);
    let synced = 0;
    try {
      for (const item of pending) {
        setDbSyncLabel(`Sincronizando ${synced + 1}/${pending.length}: ${item.chapterTitle}…`);
        const audioBytes = await fetchAudioBytesForStorage(item.audioUrl);
        await savePrerenderedAudioToFirestore({
          meta: item,
          bookId: item.bookId || resolveBookIdForChapter(item.chapterId),
          wavBytes: audioBytes,
          user: authUser,
          onProgress: (done) => {
            setDbSyncLabel(
              `Enviando ${synced + 1}/${pending.length} (${done}%): ${item.chapterTitle}`,
            );
          },
        });
        synced += 1;
      }
      setStatusNotice(
        `${synced} ${synced === 1 ? 'áudio salvo' : 'áudios salvos'} no Firestore com sucesso.`,
      );
    } catch (err) {
      setErrorMessage(formatFriendlyFirestoreError(err));
    } finally {
      setDbSyncLabel(null);
    }
  }, [authUser, cacheInventory.items, firestoreKeys, resolveBookIdForChapter]);

  const handleDownloadCacheItem = useCallback(async (item: CachedAudioMetadata) => {
    try {
      await downloadAudioFile(item.audioUrl, `${item.chapterId}-${item.mode}`, item.mimeType);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Não foi possível baixar o arquivo de áudio.',
      );
    }
  }, []);

  const loadedAudioCacheKey = loadedAudioMeta?.cacheKey ?? null;

  const handleDeleteCacheItem = useCallback(
    async (cacheKey: string) => {
      setErrorMessage(null);
      try {
        if (firestoreKeys.has(cacheKey)) {
          setDbSyncLabel('Removendo registro da nuvem…');
          await deletePrerenderedAudioFromFirestore(cacheKey);
          await evictBrowserAudioCache(`firestore://${cacheKey}`);
        }
        try {
          const res = await authFetch(`/api/cache/${encodeURIComponent(cacheKey)}`, {
            method: 'DELETE',
          });
          if (res.ok) {
            const data = await safeParseJson<{ inventory: CacheInventoryResponse }>(res);
            setLocalCacheInventory(mergeWithStaticCacheInventory(data.inventory));
          }
        } catch {
          // Non-fatal if static/serverless
        }
        await evictBrowserAudioCache(`/api/audio/${cacheKey}`);
        if (loadedAudioCacheKey === cacheKey) {
          resetAudioElement();
        }
        setStatusNotice('Registro de áudio removido.');
      } catch (err) {
        setErrorMessage(formatFriendlyFirestoreError(err));
      } finally {
        setDbSyncLabel(null);
      }
    },
    [firestoreKeys, loadedAudioCacheKey, resetAudioElement],
  );

  const handleChapterCreated = useCallback(
    (newChapter: Chapter) => {
      stopLocalSpeech();
      resetAudioElement();
      setCustomChapters((prev) => [...prev, newChapter]);
      setLoadedChapters((prev) => ({ ...prev, [newChapter.id]: newChapter }));
      setSelectedBookId(newChapter.bookId);
      setSelectedChapterId(newChapter.id);
      setStatusNotice(`"${newChapter.title}" pré-ajustado por IA com ${newChapter.characters.length} vozes.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [resetAudioElement, stopLocalSpeech],
  );

  const handleBookAdded = useCallback(
    async ({
      book,
      firstChapter,
      fullBook,
      catalog,
    }: {
      book: BookCatalogItem;
      firstChapter: Chapter | null;
      fullBook?: Book;
      catalog: BookCatalogItem[];
    }) => {
      setServerCatalog(catalog);
      if (fullBook) {
        setLoadedChapters((prev) => {
          const next = { ...prev };
          for (const ch of fullBook.chapters) {
            next[ch.id] = ch;
          }
          return next;
        });
      } else if (firstChapter) {
        setLoadedChapters((prev) => ({ ...prev, [firstChapter.id]: firstChapter }));
      }
      const targetChapterId = firstChapter?.id ?? book.chapters[0]?.id;
      if (targetChapterId) {
        stopLocalSpeech();
        resetAudioElement();
        setSelectedBookId(book.id);
        setSelectedChapterId(targetChapterId);
      }
      if (isAdmin && authUser?.emailVerified && fullBook) {
        try {
          await saveCustomBookToFirestore(fullBook, authUser);
          setStatusNotice(
            `"${book.title}" adicionado e salvo no Firestore (${book.chapters.length} ${book.chapters.length === 1 ? 'história' : 'histórias'}).`,
          );
        } catch (dbErr) {
          setStatusNotice(
            `"${book.title}" adicionado localmente (${dbErr instanceof Error ? dbErr.message : 'sem sincronização em nuvem'}).`,
          );
        }
      } else {
        setStatusNotice(
          `"${book.title}" adicionado à biblioteca (${book.chapters.length} ${book.chapters.length === 1 ? 'história' : 'histórias'}).`,
        );
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [authUser, isAdmin, resetAudioElement, stopLocalSpeech],
  );

  const handleOpenExistingBook = useCallback(
    (bookId: string) => {
      const target = books.find((b) => b.id === bookId);
      if (!target || target.chapters.length === 0) return;
      handleSelectChapter(target.id, target.chapters[0].id);
    },
    [books, handleSelectChapter],
  );

  const handleDeleteBook = useCallback(
    async (bookId: string) => {
      try {
        if (isAdmin && authUser?.emailVerified && cloudCustomBooks.some((b) => b.id === bookId)) {
          await deleteCustomBookFromFirestore(bookId);
        }
        const res = await authFetch(`/api/books/${encodeURIComponent(bookId)}`, {
          method: 'DELETE',
        });
        const data = await safeParseJson<{
          removed?: boolean;
          catalog?: BookCatalogItem[];
          error?: string;
        }>(res, 'Não foi possível remover a coleção.');
        if (!res.ok && res.status !== 404) {
          throw new Error(data.error || 'Não foi possível remover a coleção.');
        }
        if (Array.isArray(data.catalog) && data.catalog.length > 0) {
          setServerCatalog(data.catalog);
          if (selectedBookId === bookId) {
            const firstBook = data.catalog[0];
            setSelectedBookId(firstBook.id);
            if (firstBook.chapters[0]) {
              setSelectedChapterId(firstBook.chapters[0].id);
            }
          }
        }
        setStatusNotice('Coleção removida da biblioteca.');
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Não foi possível remover a coleção.',
        );
      }
    },
    [authUser, cloudCustomBooks, isAdmin, selectedBookId],
  );

  const hasPrevChapter = currentChapterIndex > 0;
  const hasNextChapter = currentChapterIndex < currentBook.chapters.length - 1;

  const synthesisProgressLabel = useMemo(() => {
    const job = ttsStatus.activeJob;
    if (!isSynthesizing || !job || job.cacheKey !== currentCacheKey) return undefined;
    if (job.state === 'waiting_retry' && job.waitingRetrySec) {
      return `Aguardando cota (${job.waitingRetrySec}s)…`;
    }
    const currentPart = Math.min(job.completedBatches + 1, Math.max(1, job.totalBatches));
    if (job.reusedBatches > 0 && job.completedBatches === job.reusedBatches) {
      return `Retomando parte ${currentPart} de ${job.totalBatches}…`;
    }
    return `Pré-renderizando parte ${currentPart} de ${job.totalBatches}…`;
  }, [currentCacheKey, isSynthesizing, ttsStatus.activeJob]);

  const localSpeechTurnLabel = useMemo(() => {
    if (!isLocalSpeechActive || !currentChapter) return undefined;
    const total = currentChapter.turns.length;
    const current = Math.max(1, localSpeechTurnIndex + 1);
    return `Trecho ${current} de ${total}`;
  }, [currentChapter, isLocalSpeechActive, localSpeechTurnIndex]);

  const effectiveIsPlaying = isLocalSpeechActive ? isLocalSpeechPlaying : isPlaying;

  return (
    <div className="min-h-screen bg-[#F7F7F5] dark:bg-[#101216] text-[#14171F] dark:text-[#EAECEF] transition-colors">
      {/* Hidden native audio element */}
      <audio ref={audioRef} preload="metadata" className="sr-only" />

      {/* Non-sticky minimalist top bar */}
      <header className="relative border-b border-neutral-200/80 dark:border-neutral-800 bg-[#F7F7F5] dark:bg-[#101216]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-6">
          {/* Zone 1: Clean single-line wordmark */}
          <a
            href="#leitura"
            className="font-editorial text-lg font-semibold tracking-tight text-[#14171F] dark:text-[#EAECEF] whitespace-nowrap shrink-0"
          >
            Voz &amp; Folha
          </a>

          {/* Zone 2 & 3: Quiet navigation & actions */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <nav
              aria-label="Navegação principal"
              className="hidden lg:flex items-center gap-5 text-sm font-medium text-[#5A6474] dark:text-[#9AA4B2]"
            >
              <button
                type="button"
                onClick={() => setVoicesOpen(true)}
                disabled={!currentChapter}
                className="hover:text-[#14171F] dark:hover:text-[#EAECEF] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                Vozes
              </button>
              {isCuratorMode && (
                <>
                  <button
                    type="button"
                    onClick={() => setVoicesOpen(true)}
                    disabled={!currentChapter}
                    className="hover:text-[#14171F] dark:hover:text-[#EAECEF] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                  >
                    Banco de áudio ({cacheInventory.count})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddBookOpen(true)}
                    className="hover:text-[#14171F] dark:hover:text-[#EAECEF] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Adicionar coleção
                  </button>
                </>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleToggleCuratorMode}
                  aria-pressed={isCuratorMode}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isCuratorMode
                      ? 'bg-[#1E3A5F]/12 dark:bg-[#7FA6D6]/20 text-[#1E3A5F] dark:text-[#7FA6D6]'
                      : 'text-[#5A6474] dark:text-[#9AA4B2] hover:text-[#14171F] dark:hover:text-[#EAECEF]'
                  }`}
                >
                  {isCuratorMode ? 'Curador ativo' : 'Curador'}
                </button>
              )}
            </nav>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setChaptersOpen(true)}
                aria-label="Abrir fábulas e contos"
                className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#14171F] dark:text-[#EAECEF] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer"
              >
                <BookOpen className="w-[18px] h-[18px]" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => setDarkMode((prev) => !prev)}
                aria-label={darkMode ? 'Ativar tema claro' : 'Ativar tema noturno'}
                title={darkMode ? 'Tema claro' : 'Tema noturno'}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#5A6474] dark:text-[#9AA4B2] hover:text-[#14171F] dark:hover:text-[#EAECEF] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] cursor-pointer"
              >
                {darkMode ? (
                  <Sun className="w-[18px] h-[18px]" aria-hidden="true" />
                ) : (
                  <Moon className="w-[18px] h-[18px]" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Inline error / cache feedback banner */}
      {(errorMessage || statusNotice) && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3">
          {errorMessage && (
            <div
              role="alert"
              className="flex flex-col gap-2.5 px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-sm text-red-800 dark:text-red-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words leading-snug">{errorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMessage(null);
                    setIsQuotaError(false);
                  }}
                  aria-label="Fechar aviso de erro"
                  className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              {isQuotaError && browserSpeechSupported && currentChapter && (
                <div className="pl-6">
                  <button
                    type="button"
                    onClick={() => handleStartLocalSpeech(0)}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#1D222B] border border-red-200 dark:border-red-800/70 text-xs font-semibold text-[#1E3A5F] dark:text-[#7FA6D6] hover:bg-red-50/70 dark:hover:bg-neutral-800 inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Ouvir agora com voz local (gratuita)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {!errorMessage && statusNotice && (
            <div
              role="status"
              className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-white dark:bg-[#181B21] border border-neutral-200/80 dark:border-neutral-800 text-xs font-medium text-[#1E3A5F] dark:text-[#7FA6D6]"
            >
              <span>{statusNotice}</span>
              <button
                type="button"
                onClick={() => setStatusNotice(null)}
                aria-label="Fechar notificação"
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Responsive layout: compact sidebar + spacious editorial reading column */}
      <main id="leitura" className="max-w-6xl mx-auto lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10 lg:px-6">
        {/* Desktop left fables & fairy tales sidebar */}
        <aside
          aria-label="Índice de coleções e histórias"
          className="hidden lg:block py-7 pr-5 border-r border-neutral-200/80 dark:border-neutral-800"
        >
          <ChaptersListContent
            books={books}
            selectedBookId={currentBook.id}
            selectedChapterId={selectedChapterId}
            cachedChapterIds={cachedChapterIds}
            isCuratorMode={isCuratorMode}
            onSelectChapter={handleSelectChapter}
            onOpenAddBook={() => setAddBookOpen(true)}
            onOpenImport={() => setImportOpen(true)}
            onPrerenderBook={(id) => void handleEnqueueChaptersForBook(id, 6)}
            onDeleteBook={(id) => void handleDeleteBook(id)}
          />
        </aside>

        {/* Primary fable & fairy tale reading surface */}
        <div className="min-w-0">
          <ChapterReader
            book={currentBook}
            chapter={currentChapter}
            chapterSummary={currentChapterSummary}
            chapterPosition={currentChapterIndex + 1}
            totalChapters={currentBook.chapters.length}
            isCuratorMode={isCuratorMode}
            isLoadingChapter={isLoadingChapter}
            isDramatizing={isDramatizing}
            onDramatizeChapter={() => void handleDramatizeChapter()}
            onPrerenderCollection={() => void handleEnqueueChaptersForBook(currentBook.id, 6)}
            remainingUncachedCount={remainingUncachedChapters.length}
            mode={mode}
            onModeChange={handleModeChange}
            voiceMap={currentVoiceMap}
            activeTurnIndex={activeTurnIndex}
            isPlaying={effectiveIsPlaying}
            isLocalSpeechActive={isLocalSpeechActive}
            isCached={Boolean(serverCachedMeta)}
            cachedStorageSource={serverCachedMeta?.storageSource}
            cachedSizeBytes={serverCachedMeta?.fileSizeBytes}
            cachedDurationSec={serverCachedMeta?.durationSec}
            segments={activeSegments}
            onSeekToTurn={(idx) => void handleSeekToTurn(idx)}
            onOpenVoices={() => setVoicesOpen(true)}
            hasPrevChapter={hasPrevChapter}
            hasNextChapter={hasNextChapter}
            onPrevChapter={() => {
              if (hasPrevChapter) {
                handleSelectChapter(currentBook.id, currentBook.chapters[currentChapterIndex - 1].id);
              }
            }}
            onNextChapter={() => {
              if (hasNextChapter) {
                handleSelectChapter(currentBook.id, currentBook.chapters[currentChapterIndex + 1].id);
              }
            }}
          />
        </div>
      </main>

      {/* Fixed thumb-zone bottom audio dock */}
      <AudioDock
        hasAudioLoaded={Boolean(loadedAudioMeta)}
        isCachedOnServer={Boolean(serverCachedMeta)}
        isSynthesizing={isSynthesizing || isLoadingChapter}
        synthesisProgressLabel={synthesisProgressLabel}
        isLocalSpeechActive={isLocalSpeechActive}
        localSpeechTurnLabel={localSpeechTurnLabel}
        isPlaying={effectiveIsPlaying}
        currentTime={currentTime}
        duration={duration}
        playbackRate={playbackRate}
        downloadUrl={loadedAudioMeta?.audioUrl ?? serverCachedMeta?.audioUrl ?? null}
        onDownloadAudio={() => {
          const target = loadedAudioMeta ?? serverCachedMeta;
          if (target) void handleDownloadCacheItem(target);
        }}
        onGenerateOrPlay={() => void handleSynthesizeOrPlay(false)}
        onTogglePlayPause={() => void handleTogglePlayPause()}
        onSeek={handleSeek}
        onSkip={handleSkip}
        onSkipLocalTurn={handleSkipLocalTurn}
        onStopLocalSpeech={stopLocalSpeech}
        onCycleSpeed={handleCycleSpeed}
        onOpenChapters={() => setChaptersOpen(true)}
        onOpenVoices={() => setVoicesOpen(true)}
      />

      {/* Mobile bottom sheet: Collections & stories */}
      <ChaptersSheet
        open={chaptersOpen}
        onClose={() => setChaptersOpen(false)}
        books={books}
        selectedBookId={currentBook.id}
        selectedChapterId={selectedChapterId}
        cachedChapterIds={cachedChapterIds}
        isCuratorMode={isCuratorMode}
        onSelectChapter={handleSelectChapter}
        onOpenAddBook={() => setAddBookOpen(true)}
        onOpenImport={() => setImportOpen(true)}
        onPrerenderBook={(id) => void handleEnqueueChaptersForBook(id, 6)}
        onDeleteBook={(id) => void handleDeleteBook(id)}
      />

      {/* Bottom sheet / modal: Add collection from public domain or file/text */}
      <AddBookSheet
        open={addBookOpen}
        onClose={() => setAddBookOpen(false)}
        installedBooks={books}
        onBookAdded={(payload) => void handleBookAdded(payload)}
        onOpenExistingBook={handleOpenExistingBook}
      />

      {/* Bottom sheet / modal: Cast voices & Firestore WAV database manager */}
      {currentChapter && (
        <VoicesCacheSheet
          open={voicesOpen}
          onClose={() => setVoicesOpen(false)}
          chapter={currentChapter}
          mode={mode}
          onModeChange={handleModeChange}
          voiceMap={currentVoiceMap}
          onVoiceChange={handleVoiceChange}
          currentCacheKey={currentCacheKey}
          isCurrentCached={Boolean(serverCachedMeta)}
          isSynthesizing={isSynthesizing}
          onRegenerateCurrent={() => {
            setVoicesOpen(false);
            void handleSynthesizeOrPlay(true);
          }}
          cacheInventory={cacheInventory}
          firestoreKeys={firestoreKeys}
          authUser={authUser}
          authReady={authReady}
          isSigningIn={isSigningIn}
          isAdmin={isAdmin}
          isCuratorMode={isCuratorMode}
          onToggleCuratorMode={handleToggleCuratorMode}
          dbSyncLabel={dbSyncLabel}
          onSignInGoogle={() => void handleSignInGoogle()}
          onSignOutGoogle={() => void handleSignOutGoogle()}
          onSyncAllToFirestore={() => void handleSyncAllToFirestore()}
          onSaveItemToFirestore={(item) => void handleSaveItemToFirestore(item)}
          onDownloadCacheItem={(item) => void handleDownloadCacheItem(item)}
          onDeleteCacheItem={(key) => void handleDeleteCacheItem(key)}
          ttsStatus={ttsStatus}
          remainingUncachedCount={remainingUncachedChapters.length}
          onEnqueueNextChapters={(count) => void handleEnqueueNextChapters(count)}
          onSetPacingSec={handleSetPacingSec}
          onClearQueue={handleClearQueue}
          browserSpeechSupported={browserSpeechSupported}
          isLocalSpeechActive={isLocalSpeechActive}
          onToggleLocalSpeech={handleToggleLocalSpeech}
        />
      )}

      {/* Bottom sheet / modal: Import public domain fable excerpt */}
      <ImportChapterSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        bookId={currentBook.id}
        nextChapterNumber={currentBook.chapters.length + 1}
        onChapterCreated={handleChapterCreated}
      />
    </div>
  );
}
