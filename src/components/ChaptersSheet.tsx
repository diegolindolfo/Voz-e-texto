import { useEffect, useMemo, useRef, useState } from 'react';
import { BookPlus, Layers, Plus, Search, Trash2, X } from 'lucide-react';
import { filterChapters } from '../lib/gutenbergParser';
import type { BookCatalogItem, ChapterSummary } from '../types';
import { BookCover } from './BookCover';

interface ChaptersContentProps {
  books: BookCatalogItem[];
  selectedBookId: string;
  selectedChapterId: string;
  cachedChapterIds: Set<string>;
  isCuratorMode?: boolean;
  onSelectChapter: (bookId: string, chapterId: string) => void;
  onOpenAddBook: () => void;
  onOpenImport: () => void;
  onPrerenderBook?: (bookId: string) => void;
  onDeleteBook?: (bookId: string) => void;
  isSheet?: boolean;
}

export function ChaptersListContent({
  books,
  selectedBookId,
  selectedChapterId,
  cachedChapterIds,
  isCuratorMode = false,
  onSelectChapter,
  onOpenAddBook,
  onOpenImport,
  onPrerenderBook,
  onDeleteBook,
  isSheet = false,
}: ChaptersContentProps) {
  const [tabSelection, setTabSelection] = useState<{
    baseSelectedId: string;
    tabId: string;
  } | null>(null);
  const activeBookTabId =
    tabSelection?.baseSelectedId === selectedBookId ? tabSelection.tabId : selectedBookId;
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyCached, setOnlyCached] = useState(false);
  const activeRowRef = useRef<HTMLButtonElement | null>(null);

  const displayedBook = useMemo(
    () => books.find((b) => b.id === activeBookTabId) ?? books[0],
    [books, activeBookTabId],
  );

  const cachedCountInBook = useMemo(
    () => displayedBook.chapters.filter((c) => cachedChapterIds.has(c.id)).length,
    [displayedBook.chapters, cachedChapterIds],
  );

  const uncachedCountInBook = displayedBook.chapters.length - cachedCountInBook;

  const filteredChapters = useMemo(
    () => filterChapters(displayedBook.chapters, searchQuery, cachedChapterIds, onlyCached),
    [displayedBook.chapters, searchQuery, cachedChapterIds, onlyCached],
  );

  const currentIdxInBook = useMemo(
    () => displayedBook.chapters.findIndex((c) => c.id === selectedChapterId),
    [displayedBook.chapters, selectedChapterId],
  );

  const progressPercent =
    currentIdxInBook >= 0 && displayedBook.chapters.length > 0
      ? Math.round(((currentIdxInBook + 1) / displayedBook.chapters.length) * 100)
      : 0;

  useEffect(() => {
    if (!searchQuery && !onlyCached && activeRowRef.current) {
      activeRowRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isSheet, selectedChapterId, searchQuery, onlyCached]);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Collection selector tabs */}
      {books.length > 1 && (
        <div
          role="tablist"
          aria-label="Coleções de fábulas e contos"
          className="flex items-center gap-1.5 overflow-x-auto p-1 rounded-xl bg-[#ECECE8] dark:bg-[#191D24]"
        >
          {books.map((book) => {
            const active = book.id === displayedBook.id;
            const shortTitle =
              book.id === 'fabulas-esopo'
                ? 'Esopo'
                : book.id === 'contos-grimm-perrault'
                  ? 'Grimm & Perrault'
                  : book.id === 'contos-andersen'
                    ? 'Andersen'
                    : book.title.length > 20
                      ? `${book.title.slice(0, 19)}…`
                      : book.title;
            return (
              <button
                key={book.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setTabSelection({ baseSelectedId: selectedBookId, tabId: book.id });
                  setSearchQuery('');
                  setOnlyCached(false);
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white dark:bg-[#252B36] text-[#14171F] dark:text-[#EAECEF] shadow-xs'
                    : 'text-[#5A6474] dark:text-[#9AA4B2] hover:text-[#14171F] dark:hover:text-[#EAECEF]'
                }`}
              >
                {shortTitle}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected collection editorial summary + progress */}
      <div className="flex items-start gap-3.5">
        <BookCover
          src={displayedBook.coverUrl}
          title={displayedBook.title}
          author={displayedBook.author}
          className="w-14 shrink-0"
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-editorial text-base font-semibold text-[#14171F] dark:text-[#EAECEF] leading-snug">
              {displayedBook.title}
            </h2>
            {isCuratorMode && displayedBook.isCustom && onDeleteBook && (
              <button
                type="button"
                onClick={() => onDeleteBook(displayedBook.id)}
                aria-label={`Remover ${displayedBook.title} da biblioteca`}
                title="Remover da biblioteca"
                className="p-1.5 -mr-1.5 -mt-1 rounded-lg text-[#5A6474] hover:text-red-600 dark:hover:text-red-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <p className="text-xs text-[#5A6474] dark:text-[#9AA4B2] mt-0.5">
            {displayedBook.author} · {displayedBook.year}
          </p>
          <p className="text-[11px] text-[#5A6474] dark:text-[#9AA4B2] mt-1 font-mono-tabular">
            {cachedCountInBook} de {displayedBook.chapters.length} com áudio pronto
          </p>
          {currentIdxInBook >= 0 && displayedBook.chapters.length > 1 && (
            <div className="mt-1.5 h-[2px] w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1E3A5F] dark:bg-[#7FA6D6]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Story search & pre-rendered filter */}
      {displayedBook.chapters.length >= 4 && (
        <div className="space-y-2">
          <div className="relative">
            <Search
              className="w-4 h-4 text-[#8A94A3] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar fábula ou conto (ex.: Cigarra, Lobo, Patinho)…"
              aria-label="Buscar fábula ou conto por título"
              className="w-full min-h-[42px] pl-9 pr-9 py-2 rounded-xl bg-white dark:bg-[#1D222B] border border-neutral-200 dark:border-neutral-800 text-xs text-[#14171F] dark:text-[#EAECEF] placeholder:text-[#8A94A3] focus:outline-2 focus:outline-[#1E3A5F]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpar busca de histórias"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#5A6474] hover:text-[#14171F] dark:hover:text-[#EAECEF] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label="Filtrar histórias"
            className="flex items-center gap-1 p-1 rounded-xl bg-[#ECECE8] dark:bg-[#191D24]"
          >
            <button
              type="button"
              onClick={() => setOnlyCached(false)}
              aria-pressed={!onlyCached}
              className={`flex-1 min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                !onlyCached
                  ? 'bg-white dark:bg-[#252B36] text-[#14171F] dark:text-[#EAECEF] shadow-xs'
                  : 'text-[#5A6474] dark:text-[#9AA4B2]'
              }`}
            >
              Todas ({displayedBook.chapters.length})
            </button>
            <button
              type="button"
              onClick={() => setOnlyCached(true)}
              aria-pressed={onlyCached}
              className={`flex-1 min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                onlyCached
                  ? 'bg-white dark:bg-[#252B36] text-[#14171F] dark:text-[#EAECEF] shadow-xs'
                  : 'text-[#5A6474] dark:text-[#9AA4B2]'
              }`}
            >
              Com áudio ({cachedCountInBook})
            </button>
          </div>
        </div>
      )}

      {/* Scrollable fables & stories list */}
      <div
        className={
          isSheet
            ? 'flex-1 min-h-0'
            : 'lg:max-h-[calc(100vh-27rem)] lg:overflow-y-auto lg:pr-1'
        }
      >
        {filteredChapters.length === 0 ? (
          <p className="py-8 text-center text-xs text-[#5A6474] dark:text-[#9AA4B2]">
            {onlyCached
              ? 'Nenhuma história desta coleção possui áudio pronto ainda.'
              : `Nenhuma história encontrada para "${searchQuery}".`}
          </p>
        ) : (
          <ul
            className="divide-y divide-neutral-200/70 dark:divide-neutral-800/80 border-t border-b border-neutral-200/70 dark:border-neutral-800/80"
            data-testid="chapters-list"
          >
            {filteredChapters.map((chapter: ChapterSummary) => {
              const isSelected = chapter.id === selectedChapterId;
              const isCached = cachedChapterIds.has(chapter.id);
              return (
                <li key={chapter.id}>
                  <button
                    ref={isSelected ? activeRowRef : null}
                    type="button"
                    onClick={() => onSelectChapter(displayedBook.id, chapter.id)}
                    aria-current={isSelected ? 'page' : undefined}
                    className={`w-full min-h-[54px] py-2.5 px-2.5 text-left flex items-center justify-between gap-3 transition-colors rounded-lg cursor-pointer ${
                      isSelected
                        ? 'bg-[#1E3A5F]/[0.08] dark:bg-[#7FA6D6]/[0.14]'
                        : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#14171F] dark:text-[#EAECEF] truncate">
                        <span className="font-mono-tabular text-xs text-[#5A6474] dark:text-[#9AA4B2] mr-1.5">
                          {chapter.roman}.
                        </span>
                        {chapter.title}
                      </p>
                      <p className="text-xs text-[#5A6474] dark:text-[#9AA4B2] mt-0.5">
                        {isCuratorMode ? (
                          <>
                            <span>{chapter.dramatizedByAi ? 'Pré-ajustado IA' : 'Texto'}</span>
                            <span aria-hidden="true"> · </span>
                          </>
                        ) : null}
                        <span>
                          {chapter.characterCount}{' '}
                          {chapter.characterCount === 1 ? 'voz' : 'vozes'}
                        </span>
                        <span aria-hidden="true"> · </span>
                        {isCached ? (
                          <span className="text-[#1E3A5F] dark:text-[#7FA6D6] font-medium">
                            Áudio pronto
                          </span>
                        ) : (
                          <span>~{chapter.estimatedMinutes} min</span>
                        )}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Curator actions: Pre-render collection + Add new collection + quick fable import */}
      {isCuratorMode && (
        <div className="pt-1 space-y-2 shrink-0">
          {uncachedCountInBook > 0 && onPrerenderBook && (
            <button
              type="button"
              onClick={() => onPrerenderBook(displayedBook.id)}
              className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-[#1E3A5F] dark:text-[#7FA6D6] hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Pré-renderizar coleção ({uncachedCountInBook} em MP3)</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAddBook}
            className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#1E3A5F] dark:bg-[#7FA6D6] text-white dark:text-[#101216] text-sm font-semibold hover:bg-[#162C49] dark:hover:bg-[#93B6E0] flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
          >
            <BookPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Adicionar coleção</span>
          </button>

          <button
            type="button"
            onClick={onOpenImport}
            className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-[#5A6474] dark:text-[#9AA4B2] hover:text-[#14171F] dark:hover:text-[#EAECEF] hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Importar fábula ou conto com IA</span>
          </button>
        </div>
      )}
    </div>
  );
}

interface ChaptersSheetProps extends Omit<ChaptersContentProps, 'isSheet'> {
  open: boolean;
  onClose: () => void;
}

export function ChaptersSheet({
  open,
  onClose,
  books,
  selectedBookId,
  selectedChapterId,
  cachedChapterIds,
  isCuratorMode = false,
  onSelectChapter,
  onOpenAddBook,
  onOpenImport,
  onPrerenderBook,
  onDeleteBook,
}: ChaptersSheetProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Coleções de fábulas e contos"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-md max-h-[88vh] bg-[#F7F7F5] dark:bg-[#14171D] rounded-t-3xl sm:rounded-3xl border-t sm:border border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden">
        <div className="pt-3 pb-2 px-5 border-b border-neutral-200/80 dark:border-neutral-800 shrink-0">
          <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700 mx-auto mb-3 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-editorial text-lg font-semibold text-[#14171F] dark:text-[#EAECEF]">
              Fábulas e contos infantis
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar biblioteca"
              className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-full text-[#5A6474] dark:text-[#9AA4B2] hover:bg-neutral-200/60 dark:hover:bg-neutral-800 cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-4 pb-safe flex-1">
          <ChaptersListContent
            books={books}
            selectedBookId={selectedBookId}
            selectedChapterId={selectedChapterId}
            cachedChapterIds={cachedChapterIds}
            isCuratorMode={isCuratorMode}
            isSheet
            onSelectChapter={(bookId, chapterId) => {
              onSelectChapter(bookId, chapterId);
              onClose();
            }}
            onOpenAddBook={() => {
              onClose();
              onOpenAddBook();
            }}
            onOpenImport={() => {
              onClose();
              onOpenImport();
            }}
            onPrerenderBook={onPrerenderBook}
            onDeleteBook={onDeleteBook}
          />
        </div>
      </div>
    </div>
  );
}
