import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Check, Download, FileUp, Loader2, Search, X } from 'lucide-react';
import { PUBLIC_DOMAIN_CATALOG } from '../data/publicDomainCatalog';
import { safeParseJson, authFetch } from '../lib/apiClient';
import { normalizeSearchText, parsePublicDomainBookText } from '../lib/gutenbergParser';
import type { Book, BookCatalogItem, Chapter, PublicDomainCatalogEntry } from '../types';

type AddBookTab = 'public-domain' | 'import';

interface AddBookSheetProps {
  open: boolean;
  onClose: () => void;
  installedBooks: BookCatalogItem[];
  onBookAdded: (payload: {
    book: BookCatalogItem;
    firstChapter: Chapter | null;
    fullBook?: Book;
    catalog: BookCatalogItem[];
  }) => void;
  onOpenExistingBook: (bookId: string) => void;
}

export function AddBookSheet({
  open,
  onClose,
  installedBooks,
  onBookAdded,
  onOpenExistingBook,
}: AddBookSheetProps) {
  const [activeTab, setActiveTab] = useState<AddBookTab>('public-domain');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [customGutenbergId, setCustomGutenbergId] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Import custom book state
  const [bookTitle, setBookTitle] = useState('');
  const [bookAuthor, setBookAuthor] = useState('');
  const [bookYear, setBookYear] = useState('');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isImportingText, setIsImportingText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const installedBySlug = useMemo(() => {
    const map = new Map<string, BookCatalogItem>();
    for (const b of installedBooks) {
      map.set(b.id, b);
    }
    return map;
  }, [installedBooks]);

  const installedByGutenbergId = useMemo(() => {
    const map = new Map<number, BookCatalogItem>();
    for (const b of installedBooks) {
      if (typeof b.gutenbergId === 'number') {
        map.set(b.gutenbergId, b);
      }
    }
    return map;
  }, [installedBooks]);

  const filteredCatalog = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    if (!q) return PUBLIC_DOMAIN_CATALOG;
    return PUBLIC_DOMAIN_CATALOG.filter((entry) =>
      normalizeSearchText(`${entry.title} ${entry.author} ${entry.year} ${entry.synopsis}`).includes(
        q,
      ),
    );
  }, [searchQuery]);

  const importPreview = useMemo(() => {
    const trimmed = rawText.trim();
    if (trimmed.length < 40) return null;
    const chapters = parsePublicDomainBookText(trimmed);
    const words = chapters.reduce((acc, c) => acc + c.wordCount, 0);
    return { chapterCount: chapters.length, words };
  }, [rawText]);

  if (!open) return null;

  const isBusy = downloadingKey !== null || isImportingText;

  const handleDownloadGutenberg = async (
    params: { slug?: string; gutenbergId?: number; entry?: PublicDomainCatalogEntry },
  ) => {
    const key = params.slug ?? String(params.gutenbergId ?? '');
    setErrorMessage(null);
    setDownloadingKey(key);
    try {
      const response = await authFetch('/api/books/import-gutenberg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: params.slug,
          gutenbergId: params.gutenbergId,
          title: params.entry?.title,
          author: params.entry?.author,
          year: params.entry?.year,
          synopsis: params.entry?.synopsis,
        }),
      });
      const data = await safeParseJson<{
        book?: BookCatalogItem;
        firstChapter?: Chapter | null;
        fullBook?: Book;
        catalog?: BookCatalogItem[];
        error?: string;
      }>(response, 'Não foi possível adicionar a coleção do domínio público.');
      if (!response.ok || !data.book || !data.catalog) {
        throw new Error(data.error || 'Não foi possível adicionar a coleção do domínio público.');
      }

      onBookAdded({
        book: data.book,
        firstChapter: data.firstChapter ?? null,
        fullBook: data.fullBook,
        catalog: data.catalog,
      });
      setCustomGutenbergId('');
      onClose();
    } catch (err) {
      const entry = params.entry;
      if (entry?.prebuiltChapters && entry.prebuiltChapters.length > 0) {
        const localFullBook: Book = {
          id: entry.slug,
          title: entry.title,
          author: entry.author,
          year: entry.year,
          publicDomainSource: 'Domínio Público · Roteiro pré-ajustado por IA',
          coverUrl: '',
          synopsis: entry.synopsis,
          ...(typeof entry.gutenbergId === 'number' ? { gutenbergId: entry.gutenbergId } : {}),
          isCustom: true,
          chapters: entry.prebuiltChapters,
        };
        const localBook: BookCatalogItem = {
          id: localFullBook.id,
          title: localFullBook.title,
          author: localFullBook.author,
          year: localFullBook.year,
          publicDomainSource: localFullBook.publicDomainSource,
          coverUrl: localFullBook.coverUrl,
          synopsis: localFullBook.synopsis,
          ...(typeof localFullBook.gutenbergId === 'number'
            ? { gutenbergId: localFullBook.gutenbergId }
            : {}),
          isCustom: true,
          chapters: entry.prebuiltChapters.map((ch) => ({
            id: ch.id,
            bookId: ch.bookId,
            number: ch.number,
            roman: ch.roman,
            numberLabel: ch.numberLabel,
            title: ch.title,
            estimatedMinutes: ch.estimatedMinutes,
            wordCount: ch.wordCount,
            characterCount: ch.characterCount,
            hasDialogue: ch.hasDialogue,
            dramatizedByAi: ch.dramatizedByAi,
            moral: ch.moral,
            aiNotes: ch.aiNotes,
            isCustom: ch.isCustom,
          })),
        };
        onBookAdded({
          book: localBook,
          firstChapter: entry.prebuiltChapters[0],
          fullBook: localFullBook,
          catalog: [...installedBooks, localBook],
        });
        onClose();
        return;
      }
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao adicionar coleção em domínio público.',
      );
    } finally {
      setDownloadingKey(null);
    }
  };

  const handleCustomGutenbergSubmit = (e: FormEvent) => {
    e.preventDefault();
    const id = Number.parseInt(customGutenbergId.trim(), 10);
    if (!Number.isFinite(id) || id <= 0) {
      setErrorMessage('Digite apenas o número da obra no Project Gutenberg.');
      return;
    }
    void handleDownloadGutenberg({ gutenbergId: id });
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('O arquivo excede o limite de 5 MB.');
      return;
    }

    try {
      const text = await file.text();
      setRawText(text);
      setFileName(file.name);
      if (!bookTitle.trim()) {
        const inferred = file.name
          .replace(/\.(txt|md|markdown)$/i, '')
          .replace(/[-_]+/g, ' ')
          .trim();
        if (inferred) setBookTitle(inferred);
      }
    } catch {
      setErrorMessage('Não foi possível ler o arquivo selecionado.');
    }
  };

  const handleImportTextSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanTitle = bookTitle.trim();
    const cleanText = rawText.trim();

    if (!cleanTitle) {
      setErrorMessage('Informe o título da coleção ou conto antes de importar.');
      return;
    }
    if (cleanText.length < 40) {
      setErrorMessage('Envie um arquivo ou cole o texto da fábula (mínimo de 40 caracteres).');
      return;
    }

    setErrorMessage(null);
    setIsImportingText(true);
    try {
      const response = await authFetch('/api/books/import-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cleanTitle,
          author: bookAuthor.trim() || 'Tradição Popular',
          year: bookYear.trim() ? Number.parseInt(bookYear.trim(), 10) : undefined,
          rawText: cleanText,
        }),
      });
      const data = await safeParseJson<{
        book?: BookCatalogItem;
        firstChapter?: Chapter | null;
        fullBook?: Book;
        catalog?: BookCatalogItem[];
        error?: string;
      }>(response, 'Não foi possível importar a coleção.');
      if (!response.ok || !data.book || !data.catalog) {
        throw new Error(data.error || 'Não foi possível importar a coleção.');
      }

      onBookAdded({
        book: data.book,
        firstChapter: data.firstChapter ?? null,
        fullBook: data.fullBook,
        catalog: data.catalog,
      });
      setBookTitle('');
      setBookAuthor('');
      setBookYear('');
      setRawText('');
      setFileName(null);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao importar a coleção.');
    } finally {
      setIsImportingText(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Adicionar coleção de fábulas ou contos"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isBusy) onClose();
      }}
    >
      <div className="w-full sm:max-w-lg max-h-[90vh] bg-[#F7F7F5] dark:bg-[#14171D] rounded-t-3xl sm:rounded-3xl border-t sm:border border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="pt-3 pb-3 px-5 border-b border-neutral-200/80 dark:border-neutral-800 shrink-0">
          <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700 mx-auto mb-3 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-editorial text-lg font-semibold text-[#14171F] dark:text-[#EAECEF]">
                Adicionar coleção de fábulas e contos
              </h2>
              <p className="text-xs text-[#5A6474] dark:text-[#9AA4B2]">
                Escolha coletâneas infantis pré-ajustadas por IA ou importe novos contos.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              aria-label="Fechar adicionar coleção"
              className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-full text-[#5A6474] dark:text-[#9AA4B2] hover:bg-neutral-200/60 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-40"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* Two-tab selector */}
          <div
            role="tablist"
            aria-label="Origem da coleção"
            className="mt-3 grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#ECECE8] dark:bg-[#191D24]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'public-domain'}
              onClick={() => {
                setActiveTab('public-domain');
                setErrorMessage(null);
              }}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'public-domain'
                  ? 'bg-white dark:bg-[#252B36] text-[#14171F] dark:text-[#EAECEF] shadow-xs'
                  : 'text-[#5A6474] dark:text-[#9AA4B2]'
              }`}
            >
              Acervo pré-ajustado
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'import'}
              onClick={() => {
                setActiveTab('import');
                setErrorMessage(null);
              }}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === 'import'
                  ? 'bg-white dark:bg-[#252B36] text-[#14171F] dark:text-[#EAECEF] shadow-xs'
                  : 'text-[#5A6474] dark:text-[#9AA4B2]'
              }`}
            >
              Importar arquivo ou texto
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 pb-safe flex-1 space-y-4">
          {errorMessage && (
            <p
              role="alert"
              className="text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl px-3.5 py-2.5"
            >
              {errorMessage}
            </p>
          )}

          {activeTab === 'public-domain' ? (
            <div className="space-y-4">
              {/* Filter curated fable collections */}
              <div className="relative">
                <Search
                  className="w-4 h-4 text-[#8A94A3] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar coleções (ex.: Esopo, Grimm, La Fontaine, Carochinha)…"
                  aria-label="Filtrar coleções de fábulas e contos"
                  className="w-full min-h-[42px] pl-9 pr-9 py-2 rounded-xl bg-white dark:bg-[#1D222B] border border-neutral-200 dark:border-neutral-800 text-xs text-[#14171F] dark:text-[#EAECEF] placeholder:text-[#8A94A3] focus:outline-2 focus:outline-[#1E3A5F]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Limpar busca de coleções"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#5A6474] hover:text-[#14171F] dark:hover:text-[#EAECEF] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Curated list */}
              <ul
                className="divide-y divide-neutral-200/80 dark:divide-neutral-800 border-t border-b border-neutral-200/80 dark:border-neutral-800"
                data-testid="public-domain-catalog-list"
              >
                {filteredCatalog.map((entry) => {
                  const installedBook =
                    installedBySlug.get(entry.slug) ??
                    (typeof entry.gutenbergId === 'number'
                      ? installedByGutenbergId.get(entry.gutenbergId)
                      : undefined);
                  const isDownloadingThis = downloadingKey === entry.slug;

                  return (
                    <li
                      key={entry.slug}
                      className="py-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-editorial text-[15px] font-semibold text-[#14171F] dark:text-[#EAECEF] leading-snug">
                          {entry.title}
                        </p>
                        <p className="text-xs text-[#5A6474] dark:text-[#9AA4B2] mt-0.5">
                          {entry.author} · {entry.year} · Pré-ajustado por IA
                        </p>
                        <p className="text-xs text-[#5A6474] dark:text-[#9AA4B2] mt-1 line-clamp-2 leading-relaxed">
                          {entry.synopsis}
                        </p>
                      </div>

                      {installedBook ? (
                        <button
                          type="button"
                          onClick={() => {
                            onOpenExistingBook(installedBook.id);
                            onClose();
                          }}
                          className="min-h-[42px] px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-[#1E3A5F] dark:text-[#7FA6D6] hover:bg-neutral-100 dark:hover:bg-neutral-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Abrir</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void handleDownloadGutenberg({
                              slug: entry.slug,
                              gutenbergId: entry.gutenbergId,
                              entry,
                            })
                          }
                          className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#1E3A5F] dark:bg-[#7FA6D6] text-white dark:text-[#101216] text-xs font-semibold hover:bg-[#162C49] dark:hover:bg-[#93B6E0] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                        >
                          {isDownloadingThis ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                              <span>Adicionando…</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Adicionar</span>
                            </>
                          )}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* Direct Project Gutenberg ID importer */}
              <form
                onSubmit={handleCustomGutenbergSubmit}
                className="pt-1 space-y-2"
              >
                <label
                  htmlFor="custom-gutenberg-id"
                  className="block text-xs font-medium text-[#5A6474] dark:text-[#9AA4B2]"
                >
                  Ou informe um ID do Project Gutenberg em domínio público
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="custom-gutenberg-id"
                    type="text"
                    inputMode="numeric"
                    value={customGutenbergId}
                    onChange={(e) => setCustomGutenbergId(e.target.value)}
                    placeholder="Ex.: 28371"
                    className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#1D222B] border border-neutral-300 dark:border-neutral-700 text-sm text-[#14171F] dark:text-[#EAECEF] placeholder:text-[#8A94A3] focus:outline-2 focus:outline-[#1E3A5F]"
                  />
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="min-h-[44px] px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-[#14171F] dark:text-[#EAECEF] hover:bg-neutral-100 dark:hover:bg-neutral-800 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    Baixar por ID
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <form onSubmit={handleImportTextSubmit} className="space-y-4">
              {/* File upload trigger */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.markdown,text/plain,text/markdown"
                  onChange={(e) => void handleFileChange(e)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-white/70 dark:bg-[#1D222B]/70 hover:bg-white dark:hover:bg-[#1D222B] text-xs font-medium text-[#14171F] dark:text-[#EAECEF] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <FileUp className="w-4 h-4 text-[#1E3A5F] dark:text-[#7FA6D6]" aria-hidden="true" />
                  <span>
                    {fileName
                      ? `Arquivo carregado: ${fileName}`
                      : 'Escolher arquivo .txt ou .md de fábulas'}
                  </span>
                </button>
              </div>

              <div>
                <label
                  htmlFor="import-book-title"
                  className="block text-xs font-semibold text-[#5A6474] dark:text-[#9AA4B2] mb-1.5"
                >
                  Título da coleção ou conto
                </label>
                <input
                  id="import-book-title"
                  type="text"
                  value={bookTitle}
                  onChange={(e) => setBookTitle(e.target.value)}
                  placeholder="Ex.: Fábulas da Floresta Encantada"
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#1D222B] border border-neutral-300 dark:border-neutral-700 text-sm text-[#14171F] dark:text-[#EAECEF] placeholder:text-[#8A94A3] focus:outline-2 focus:outline-[#1E3A5F]"
                />
              </div>

              <div className="grid grid-cols-[1fr_96px] gap-2.5">
                <div>
                  <label
                    htmlFor="import-book-author"
                    className="block text-xs font-semibold text-[#5A6474] dark:text-[#9AA4B2] mb-1.5"
                  >
                    Autor(a) ou tradição
                  </label>
                  <input
                    id="import-book-author"
                    type="text"
                    value={bookAuthor}
                    onChange={(e) => setBookAuthor(e.target.value)}
                    placeholder="Ex.: Esopo / Tradição Popular"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#1D222B] border border-neutral-300 dark:border-neutral-700 text-sm text-[#14171F] dark:text-[#EAECEF] placeholder:text-[#8A94A3] focus:outline-2 focus:outline-[#1E3A5F]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="import-book-year"
                    className="block text-xs font-semibold text-[#5A6474] dark:text-[#9AA4B2] mb-1.5"
                  >
                    Ano
                  </label>
                  <input
                    id="import-book-year"
                    type="text"
                    inputMode="numeric"
                    value={bookYear}
                    onChange={(e) => setBookYear(e.target.value)}
                    placeholder="1884"
                    className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-white dark:bg-[#1D222B] border border-neutral-300 dark:border-neutral-700 text-sm text-[#14171F] dark:text-[#EAECEF] placeholder:text-[#8A94A3] focus:outline-2 focus:outline-[#1E3A5F]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="import-book-text"
                  className="block text-xs font-semibold text-[#5A6474] dark:text-[#9AA4B2] mb-1.5"
                >
                  Texto das fábulas ou contos
                </label>
                <textarea
                  id="import-book-text"
                  rows={7}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Cole o texto completo aqui. Histórias marcadas com # Título ou CAPÍTULO I são separadas automaticamente."
                  className="w-full px-3.5 py-3 rounded-xl bg-white dark:bg-[#1D222B] border border-neutral-300 dark:border-neutral-700 font-serif-reading text-[15px] leading-relaxed text-[#14171F] dark:text-[#EAECEF] placeholder:font-sans placeholder:text-xs placeholder:text-[#8A94A3] focus:outline-2 focus:outline-[#1E3A5F]"
                />
                {importPreview && (
                  <p className="mt-1.5 text-xs text-[#1E3A5F] dark:text-[#7FA6D6] font-mono-tabular">
                    {importPreview.chapterCount === 1
                      ? '1 história detectada'
                      : `${importPreview.chapterCount} histórias detectadas`}{' '}
                    · {importPreview.words.toLocaleString('pt-BR')} palavras
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isBusy}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium text-[#5A6474] dark:text-[#9AA4B2] hover:bg-neutral-200/60 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#1E3A5F] dark:bg-[#7FA6D6] text-white dark:text-[#101216] text-sm font-semibold hover:bg-[#162C49] dark:hover:bg-[#93B6E0] inline-flex items-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-70"
                >
                  {isImportingText ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Importando…</span>
                    </>
                  ) : (
                    <span>Adicionar à biblioteca</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
