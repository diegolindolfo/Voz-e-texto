import 'dotenv/config';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import { PUBLIC_DOMAIN_CATALOG } from '../src/data/publicDomainCatalog';
import {
  buildChapterFromRaw,
  extractGutenbergMetadata,
  parsePublicDomainBookText,
  slugifyBookId,
} from '../src/lib/gutenbergParser';
import { isDailyQuotaError, isRateLimitError } from '../src/lib/rateLimit';
import { computeChapterCacheKey } from '../src/lib/scriptParser';
import type { Book, PrebuiltVoiceName, ReadingMode, ScriptTurn } from '../src/types';
import {
  deleteCachedAudio,
  listCachedAudios,
  readCachedAudio,
  resolveAudioFile,
} from './audioCache';
import {
  deleteCustomBook,
  getBookCatalog,
  getChapterById,
  getInstalledBookIds,
  getInstalledGutenbergIds,
  readCachedDramatizedScript,
  saveBookToLibrary,
  toBookCatalogItem,
  writeCachedDramatizedScript,
} from './bookLibrary';
import {
  createRateLimitMiddleware,
  requireAdminAuth,
  requireVerifiedAuth,
} from './firebaseAuth';
import { analyzeLiteraryExcerpt, formatGeminiError } from './gemini';
import {
  clearBackgroundQueue,
  enqueueBackgroundChapters,
  getTtsStatus,
  removeQueueItem,
  runForegroundSynthesis,
  setTtsPacingSec,
} from './ttsQueue';

function runMiddleware(
  middleware: (req: Request, res: Response, next: NextFunction) => unknown,
  req: Request,
  res: Response,
): Promise<boolean> {
  return new Promise((resolve) => {
    let passed = false;
    const onFinish = () => {
      if (!passed) resolve(false);
    };
    res.once('finish', onFinish);
    Promise.resolve(
      middleware(req, res, () => {
        passed = true;
        res.removeListener('finish', onFinish);
        resolve(true);
      }),
    ).catch((err) => {
      res.removeListener('finish', onFinish);
      if (!res.headersSent) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Erro interno.' });
      }
      resolve(false);
    });
  });
}

async function fetchGutenbergText(gutenbergId: number): Promise<string> {
  const urls = [
    `https://gutenberg.pglaf.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`,
    `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`,
    `https://www.gutenberg.org/files/${gutenbergId}/${gutenbergId}-0.txt`,
  ];

  let lastError = 'Não foi possível baixar o texto do Project Gutenberg.';
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'VozEFolha-PublicDomainReader/1.0' },
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
      lastError =
        err instanceof Error ? err.message : 'Tempo esgotado ao acessar o acervo público.';
    }
  }
  throw new Error(lastError);
}

export function createApiApp(): Express {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  const aiRateLimiter = createRateLimitMiddleware({
    windowMs: 60_000,
    maxRequests: 15,
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/books', (_req, res) => {
    const cacheInventory = listCachedAudios();
    res.json({
      books: getBookCatalog(),
      cache: cacheInventory,
    });
  });

  app.get('/api/public-domain/catalog', (_req, res) => {
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
      installed:
        installedIds.has(entry.slug) ||
        (typeof entry.gutenbergId === 'number' && installedGutenberg.has(entry.gutenbergId)),
    }));
    res.json({ items });
  });

  app.post('/api/books/import-gutenberg', requireAdminAuth, async (req, res) => {
    try {
      const slug = typeof req.body?.slug === 'string' ? req.body.slug.trim() : '';
      const hasGutenbergInput =
        req.body?.gutenbergId !== undefined &&
        req.body?.gutenbergId !== null &&
        String(req.body.gutenbergId).trim() !== '';
      const gutenbergId = hasGutenbergInput
        ? Number.parseInt(String(req.body.gutenbergId), 10)
        : undefined;

      const curated =
        (slug ? PUBLIC_DOMAIN_CATALOG.find((item) => item.slug === slug) : undefined) ??
        (typeof gutenbergId === 'number'
          ? PUBLIC_DOMAIN_CATALOG.find((item) => item.gutenbergId === gutenbergId)
          : undefined);

      if (!curated) {
        if (
          typeof gutenbergId !== 'number' ||
          !Number.isFinite(gutenbergId) ||
          gutenbergId <= 0 ||
          gutenbergId > 999999
        ) {
          res.status(400).json({ error: 'Informe um número de catálogo válido.' });
          return;
        }
      }

      const existingCatalog = getBookCatalog();
      const alreadyInstalled = existingCatalog.find(
        (b) =>
          (curated && b.id === curated.slug) ||
          (typeof gutenbergId === 'number' && b.gutenbergId === gutenbergId),
      );
      if (alreadyInstalled) {
        const firstCh = getChapterById(alreadyInstalled.id, alreadyInstalled.chapters[0]?.id ?? '');
        res.json({
          book: alreadyInstalled,
          firstChapter: firstCh?.chapter ?? null,
          catalog: existingCatalog,
          alreadyInstalled: true,
        });
        return;
      }

      if (curated?.prebuiltChapters && curated.prebuiltChapters.length > 0) {
        const newBook: Book = {
          id: curated.slug,
          title: curated.title,
          author: curated.author,
          year: curated.year,
          publicDomainSource: 'Domínio Público · Roteiro pré-ajustado por IA',
          coverUrl: '',
          synopsis: curated.synopsis,
          ...(typeof curated.gutenbergId === 'number' ? { gutenbergId: curated.gutenbergId } : {}),
          isCustom: true,
          chapters: curated.prebuiltChapters,
        };
        const saved = saveBookToLibrary(newBook);
        res.json({
          book: toBookCatalogItem(saved),
          firstChapter: saved.chapters[0],
          fullBook: saved,
          catalog: getBookCatalog(),
          alreadyInstalled: false,
        });
        return;
      }

      if (typeof gutenbergId !== 'number') {
        res.status(400).json({ error: 'Informe um número de catálogo válido do Project Gutenberg.' });
        return;
      }

      const rawText = await fetchGutenbergText(gutenbergId);
      const extracted = extractGutenbergMetadata(rawText);
      const parsedChapters = parsePublicDomainBookText(rawText);

      if (parsedChapters.length === 0) {
        res.status(422).json({
          error: 'Não foi possível extrair contos ou capítulos legíveis desta obra.',
        });
        return;
      }

      const title =
        (typeof req.body?.title === 'string' && req.body.title.trim()) ||
        curated?.title ||
        extracted.title ||
        `Obra em Domínio Público #${gutenbergId}`;
      const author =
        (typeof req.body?.author === 'string' && req.body.author.trim()) ||
        curated?.author ||
        extracted.author ||
        'Domínio Público';
      const year =
        typeof req.body?.year === 'number' && Number.isFinite(req.body.year)
          ? req.body.year
          : curated?.year ?? 1890;
      const synopsis =
        (typeof req.body?.synopsis === 'string' && req.body.synopsis.trim()) ||
        curated?.synopsis ||
        `Edição em domínio público (#${gutenbergId}).`;

      const installedIds = getInstalledBookIds();
      let bookId = curated?.slug || slugifyBookId(title);
      if (installedIds.has(bookId)) {
        bookId = `${bookId}-${gutenbergId}`;
      }

      const chapters = parsedChapters.map((raw) =>
        buildChapterFromRaw(raw, bookId, {
          bookTitle: title,
          narratorName: curated?.narratorName || 'Contador de Histórias',
        }),
      );

      const newBook: Book = {
        id: bookId,
        title,
        author,
        year,
        publicDomainSource: `Domínio Público · Project Gutenberg #${gutenbergId}`,
        coverUrl: '',
        synopsis,
        gutenbergId,
        isCustom: true,
        chapters,
      };

      const saved = saveBookToLibrary(newBook);
      res.json({
        book: toBookCatalogItem(saved),
        firstChapter: saved.chapters[0],
        fullBook: saved,
        catalog: getBookCatalog(),
        alreadyInstalled: false,
      });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Não foi possível adicionar a coleção do domínio público.',
      });
    }
  });

  app.post('/api/books/import-text', requireAdminAuth, (req, res) => {
    try {
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const author =
        typeof req.body?.author === 'string' && req.body.author.trim()
          ? req.body.author.trim()
          : 'Tradição Popular';
      const rawText = typeof req.body?.rawText === 'string' ? req.body.rawText.trim() : '';
      const yearRaw = Number.parseInt(String(req.body?.year ?? ''), 10);
      const year =
        Number.isFinite(yearRaw) && yearRaw >= 1000 && yearRaw <= 2100
          ? yearRaw
          : new Date().getFullYear();

      if (!title) {
        res.status(400).json({ error: 'Informe o título da coleção ou conto antes de importar.' });
        return;
      }
      if (rawText.length < 40) {
        res.status(400).json({
          error: 'Envie ou cole o texto da fábula ou conto (mínimo de 40 caracteres).',
        });
        return;
      }

      const parsedChapters = parsePublicDomainBookText(rawText);
      if (parsedChapters.length === 0) {
        res.status(422).json({ error: 'Não foi possível identificar texto legível para importar.' });
        return;
      }

      const installedIds = getInstalledBookIds();
      let bookId = slugifyBookId(title);
      if (installedIds.has(bookId)) {
        bookId = `${bookId}-${Date.now().toString(36).slice(-4)}`;
      }

      const chapters = parsedChapters.map((raw) =>
        buildChapterFromRaw(raw, bookId, {
          bookTitle: title,
          narratorName: 'Contador de Histórias',
        }),
      );

      const newBook: Book = {
        id: bookId,
        title,
        author,
        year,
        publicDomainSource: 'Fábula ou conto importado pelo leitor',
        coverUrl: '',
        synopsis: `${chapters.length} ${chapters.length === 1 ? 'conto importado' : 'contos importados'} pelo leitor.`,
        isCustom: true,
        chapters,
      };

      const saved = saveBookToLibrary(newBook);
      res.json({
        book: toBookCatalogItem(saved),
        firstChapter: saved.chapters[0],
        fullBook: saved,
        catalog: getBookCatalog(),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Não foi possível importar o conto.',
      });
    }
  });

  app.delete('/api/books/:bookId', requireAdminAuth, (req, res) => {
    try {
      const removed = deleteCustomBook(String(req.params.bookId));
      res.json({ removed, catalog: getBookCatalog() });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Não foi possível remover a coleção.',
      });
    }
  });

  app.get('/api/books/:bookId/chapters/:chapterId', (req, res) => {
    const found = getChapterById(String(req.params.bookId), String(req.params.chapterId));
    if (!found) {
      res.status(404).json({ error: 'Fábula ou conto não encontrado na biblioteca.' });
      return;
    }
    res.json({ chapter: found.chapter });
  });

  app.post('/api/chapters/:chapterId/dramatize', async (req, res) => {
    try {
      const chapterId = String(req.params.chapterId);
      const bookId = typeof req.body?.bookId === 'string' ? req.body.bookId : 'fabulas-esopo';
      const force = Boolean(req.body?.force);

      const found = getChapterById(bookId, chapterId);
      if (!found) {
        res.status(404).json({ error: 'Fábula ou conto não encontrado para ajuste com IA.' });
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
              dramatizedByAi: true,
            },
            cached: true,
          });
          return;
        }
      }

      if (!(await runMiddleware(requireVerifiedAuth, req, res))) return;
      if (!(await runMiddleware(aiRateLimiter, req, res))) return;

      const rawText = found.chapter.turns
        .map((t) => (t.role === 'character' ? `— ${t.text}` : t.text))
        .join('\n\n');

      const analyzed = await analyzeLiteraryExcerpt({
        title: `${found.chapter.numberLabel} — ${found.chapter.title}`,
        rawText,
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
          dramatizedByAi: true,
        },
        cached: false,
      });
    } catch (err) {
      const message = formatGeminiError(
        err,
        'Não foi possível reajustar o roteiro de vozes desta fábula.',
      );
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/cache', (_req, res) => {
    res.json(listCachedAudios());
  });

  app.delete('/api/cache/:cacheKey', requireAdminAuth, (req, res) => {
    try {
      const removed = deleteCachedAudio(String(req.params.cacheKey));
      res.json({ removed, inventory: listCachedAudios() });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Não foi possível remover o item do cache.',
      });
    }
  });

  app.post('/api/chapters/cache-lookup', (req, res) => {
    try {
      const { chapterId, mode, turns, voiceMap } = req.body as {
        chapterId: string;
        mode: ReadingMode;
        turns: ScriptTurn[];
        voiceMap: Record<string, PrebuiltVoiceName>;
      };

      if (!chapterId || !Array.isArray(turns) || turns.length === 0) {
        res.status(400).json({ error: 'Dados da história incompletos para consulta de cache.' });
        return;
      }

      const cacheKey = computeChapterCacheKey({
        chapterId,
        mode: mode === 'narrator' ? 'narrator' : 'dramatized',
        turns,
        voiceMap: voiceMap ?? {},
      });

      const cached = readCachedAudio(cacheKey);
      res.json({
        cacheKey,
        cached: Boolean(cached),
        metadata: cached,
      });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Erro ao consultar cache de áudio.',
      });
    }
  });

  app.get('/api/tts/status', requireAdminAuth, (_req, res) => {
    res.json(getTtsStatus());
  });

  app.post('/api/tts/queue', requireAdminAuth, (req, res) => {
    try {
      const { bookId, chapterIds, mode, pacingSec } = req.body as {
        bookId?: string;
        chapterIds?: string[];
        mode?: ReadingMode;
        pacingSec?: number;
      };
      if (!bookId || !Array.isArray(chapterIds) || chapterIds.length === 0) {
        res.status(400).json({ error: 'Informe a coleção e as fábulas para pré-renderizar em fila.' });
        return;
      }
      const result = enqueueBackgroundChapters({
        bookId,
        chapterIds,
        mode: mode === 'narrator' ? 'narrator' : 'dramatized',
        pacingSec,
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Não foi possível enfileirar as histórias.',
      });
    }
  });

  app.patch('/api/tts/pacing', requireAdminAuth, (req, res) => {
    const raw = Number(req.body?.pacingSec);
    if (!Number.isFinite(raw) || raw < 1 || raw > 30) {
      res.status(400).json({ error: 'Informe um intervalo entre 1 e 30 segundos.' });
      return;
    }
    const updated = setTtsPacingSec(raw);
    res.json({ pacingSec: updated, status: getTtsStatus() });
  });

  app.delete('/api/tts/queue', requireAdminAuth, (_req, res) => {
    res.json({ status: clearBackgroundQueue() });
  });

  app.delete('/api/tts/queue/:chapterId', requireAdminAuth, (req, res) => {
    res.json({ status: removeQueueItem(String(req.params.chapterId)) });
  });

  app.post('/api/chapters/synthesize', async (req, res) => {
    try {
      const {
        chapterId,
        bookTitle,
        chapterTitle,
        mode,
        turns,
        voiceMap,
        forceRegenerate,
      } = req.body as {
        chapterId: string;
        bookTitle: string;
        chapterTitle: string;
        mode: ReadingMode;
        turns: ScriptTurn[];
        voiceMap: Record<string, PrebuiltVoiceName>;
        forceRegenerate?: boolean;
      };

      if (!chapterId || !Array.isArray(turns) || turns.length === 0) {
        res.status(400).json({ error: 'Envie uma fábula ou conto com ao menos um trecho de texto.' });
        return;
      }

      const safeMode: ReadingMode = mode === 'narrator' ? 'narrator' : 'dramatized';
      const safeVoiceMap = voiceMap ?? {};
      const shouldForce = Boolean(forceRegenerate);

      if (!shouldForce) {
        const cacheKey = computeChapterCacheKey({
          chapterId,
          mode: safeMode,
          turns,
          voiceMap: safeVoiceMap,
        });
        const cached = readCachedAudio(cacheKey);
        if (cached) {
          res.setHeader('X-Audio-Cache', 'HIT');
          res.json({ ...cached, cached: true });
          return;
        }
      }

      const authMiddleware = shouldForce ? requireAdminAuth : requireVerifiedAuth;
      if (!(await runMiddleware(authMiddleware, req, res))) return;
      if (!(await runMiddleware(aiRateLimiter, req, res))) return;

      const result = await runForegroundSynthesis({
        chapterId,
        bookTitle: bookTitle || 'Fábulas e Contos em Domínio Público',
        chapterTitle: chapterTitle || 'Conto',
        mode: safeMode,
        turns,
        voiceMap: safeVoiceMap,
        forceRegenerate: shouldForce,
      });

      res.setHeader('X-Audio-Cache', result.cached ? 'HIT' : 'MISS');
      res.json({ ...result.metadata, cached: result.cached });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err ?? '');
      const message = formatGeminiError(err, 'Não foi possível pré-renderizar o áudio desta história.');
      const quotaError = isRateLimitError(raw) || isDailyQuotaError(raw);
      const status =
        raw.includes('API_KEY') || raw.includes('PERMISSION_DENIED')
          ? 403
          : quotaError
            ? 429
            : 500;
      res.status(status).json({
        error: message,
        isQuotaError: quotaError,
      });
    }
  });

  app.post('/api/chapters/analyze', requireVerifiedAuth, aiRateLimiter, async (req, res) => {
    try {
      const { title, rawText } = req.body as { title?: string; rawText?: string };
      const trimmedTitle = (title ?? '').trim();
      const trimmedText = (rawText ?? '').trim();

      if (!trimmedTitle) {
        res.status(400).json({ error: 'Informe um título para a fábula ou conto.' });
        return;
      }
      if (trimmedText.length < 30) {
        res.status(400).json({ error: 'Cole pelo menos um parágrafo curto (mínimo de 30 caracteres).' });
        return;
      }
      if (trimmedText.length > 8000) {
        res.status(400).json({ error: 'Limite de 8.000 caracteres por conto importado.' });
        return;
      }

      const analyzed = await analyzeLiteraryExcerpt({
        title: trimmedTitle,
        rawText: trimmedText,
      });

      res.json(analyzed);
    } catch (err) {
      const message = formatGeminiError(
        err,
        'Não foi possível pré-ajustar o texto com inteligência artificial.',
      );
      res.status(500).json({ error: message });
    }
  });

  app.get('/api/audio/:cacheKey', (req, res) => {
    try {
      const cacheKey = String(req.params.cacheKey);
      const meta = readCachedAudio(cacheKey);
      const resolved = resolveAudioFile(cacheKey);
      if (!meta || !resolved) {
        res.status(404).json({ error: 'Áudio não encontrado no cache.' });
        return;
      }

      const stat = fs.statSync(resolved.filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      res.setHeader('Content-Type', resolved.mimeType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('X-Audio-Cache', 'HIT');

      if (req.query.download === '1') {
        const safeName = `${meta.chapterId}-${meta.mode}.${resolved.ext}`.replace(
          /[^a-zA-Z0-9._-]/g,
          '_',
        );
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
      }

      if (range) {
        const match = /bytes=(\d+)-(\d*)/.exec(range);
        if (match) {
          const start = Number.parseInt(match[1], 10);
          const end = match[2] ? Number.parseInt(match[2], 10) : fileSize - 1;
          if (start >= fileSize || end >= fileSize || start > end) {
            res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
            return;
          }
          res.status(206);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
          res.setHeader('Content-Length', end - start + 1);
          fs.createReadStream(resolved.filePath, { start, end }).pipe(res);
          return;
        }
      }

      res.setHeader('Content-Length', fileSize);
      fs.createReadStream(resolved.filePath).pipe(res);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Erro ao servir o arquivo de áudio.',
      });
    }
  });

  return app;
}
