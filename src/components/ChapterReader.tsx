import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Layers, Loader2, Sparkles, Volume2 } from 'lucide-react';
import type {
  AudioSegmentTiming,
  BookCatalogItem,
  Chapter,
  ChapterSummary,
  PrebuiltVoiceName,
  ReadingMode,
} from '../types';
import { formatBytes, formatDuration, resolveVoiceForTurn } from '../lib/scriptParser';
import { BookCover } from './BookCover';

interface ChapterReaderProps {
  book: BookCatalogItem;
  chapter: Chapter | null;
  chapterSummary?: ChapterSummary;
  chapterPosition: number;
  totalChapters: number;
  isLoadingChapter?: boolean;
  isDramatizing?: boolean;
  onDramatizeChapter?: () => void;
  onPrerenderCollection?: () => void;
  remainingUncachedCount?: number;
  mode: ReadingMode;
  onModeChange: (mode: ReadingMode) => void;
  voiceMap: Record<string, PrebuiltVoiceName>;
  activeTurnIndex: number;
  isPlaying: boolean;
  isLocalSpeechActive?: boolean;
  isCached: boolean;
  cachedStorageSource?: 'firestore' | 'static' | 'local-server';
  cachedSizeBytes?: number;
  cachedDurationSec?: number;
  segments: AudioSegmentTiming[];
  onSeekToTurn: (turnIndex: number) => void;
  onOpenVoices: () => void;
  hasPrevChapter: boolean;
  hasNextChapter: boolean;
  onPrevChapter: () => void;
  onNextChapter: () => void;
}

export function ChapterReader({
  book,
  chapter,
  chapterSummary,
  chapterPosition,
  totalChapters,
  isLoadingChapter = false,
  isDramatizing = false,
  onDramatizeChapter,
  onPrerenderCollection,
  remainingUncachedCount = 0,
  mode,
  onModeChange,
  voiceMap,
  activeTurnIndex,
  isPlaying,
  isLocalSpeechActive = false,
  isCached,
  cachedStorageSource,
  cachedSizeBytes,
  cachedDurationSec,
  segments,
  onSeekToTurn,
  onOpenVoices,
  hasPrevChapter,
  hasNextChapter,
  onPrevChapter,
  onNextChapter,
}: ChapterReaderProps) {
  const turnRefs = useRef<Array<HTMLElement | null>>([]);
  const primaryNarratorVoice =
    (chapter && voiceMap[chapter.characters[0]?.name]) ??
    chapter?.characters[0]?.defaultVoice ??
    'Charon';

  useEffect(() => {
    if (isPlaying && activeTurnIndex >= 0) {
      const target = turnRefs.current[activeTurnIndex];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeTurnIndex, isPlaying]);

  const uniqueVoiceCount = chapter
    ? mode === 'narrator'
      ? 1
      : new Set(
          chapter.turns.map((t) => resolveVoiceForTurn(t, voiceMap, mode, primaryNarratorVoice)),
        ).size
    : mode === 'narrator'
      ? 1
      : Math.max(1, chapterSummary?.characterCount ?? 1);

  const numberLabel = chapter?.numberLabel ?? chapterSummary?.numberLabel ?? '';
  const title = chapter?.title ?? chapterSummary?.title ?? 'Abrindo fábula…';
  const estimatedMinutes = chapter?.estimatedMinutes ?? chapterSummary?.estimatedMinutes ?? 1;
  const characterCount = chapter?.characters.length ?? chapterSummary?.characterCount ?? 1;
  const moral = chapter?.moral ?? chapterSummary?.moral;
  const aiNotes =
    chapter?.aiNotes ??
    chapterSummary?.aiNotes ??
    (chapter?.dramatizedByAi
      ? `Roteiro pré-ajustado por IA · ${characterCount} vozes naturais e direção expressiva`
      : undefined);

  const canRefineWithAi = Boolean(
    chapter && !isLoadingChapter && !chapter.dramatizedByAi && onDramatizeChapter,
  );

  return (
    <article className="w-full max-w-[66ch] mx-auto px-5 sm:px-8 pt-6 pb-36 lg:pt-10 lg:pb-32">
      {/* Compact editorial fable & storybook header */}
      <header className="mb-8 pb-6 border-b border-neutral-200/80 dark:border-neutral-800">
        <div className="flex items-start gap-4 mb-5 lg:hidden">
          <BookCover
            src={book.coverUrl}
            title={book.title}
            author={book.author}
            className="w-16 shrink-0 shadow-xs"
          />
          <div className="min-w-0 pt-0.5">
            <p className="text-xs font-medium text-[#5A6474] dark:text-[#9AA4B2] truncate">
              {book.author} · {book.year}
            </p>
            <p className="font-editorial text-lg font-semibold text-[#14171F] dark:text-[#EAECEF] leading-snug">
              {book.title}
            </p>
            <p className="text-xs text-[#5A6474] dark:text-[#9AA4B2] mt-1">
              Domínio público{totalChapters > 1 ? ` · ${totalChapters} histórias` : ''}
            </p>
          </div>
        </div>

        <p
          className="text-xs font-medium text-[#1E3A5F] dark:text-[#7FA6D6] tracking-wide mb-1.5 font-mono-tabular"
          data-testid="chapter-position"
        >
          {numberLabel}
          {totalChapters > 1 ? ` · ${chapterPosition} de ${totalChapters}` : ''}
        </p>

        <h1 className="font-editorial text-[2rem] sm:text-[2.45rem] font-semibold tracking-tight text-[#14171F] dark:text-[#EAECEF] leading-[1.15]">
          {title}
        </h1>

        {chapter?.summary && (
          <p className="mt-3 text-sm leading-relaxed text-[#5A6474] dark:text-[#9AA4B2]">
            {chapter.summary}
          </p>
        )}

        {/* Quiet unboxed metadata line */}
        <div
          className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5A6474] dark:text-[#9AA4B2]"
          data-testid="chapter-metadata"
        >
          <span className="text-[#1E3A5F] dark:text-[#7FA6D6] font-medium">
            {chapter?.dramatizedByAi ? 'Pré-ajustado por IA' : 'Texto integral'}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {uniqueVoiceCount === 1 ? '1 voz natural' : `${uniqueVoiceCount} vozes naturais`}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">
            {cachedDurationSec
              ? formatDuration(cachedDurationSec)
              : `~${estimatedMinutes} min`}
          </span>
          <span aria-hidden="true">·</span>
          <span
            className={
              isCached
                ? 'text-[#1E3A5F] dark:text-[#7FA6D6] font-medium'
                : 'text-[#5A6474] dark:text-[#9AA4B2]'
            }
          >
            {isCached
              ? `${cachedStorageSource === 'firestore' ? 'Salvo no banco Firestore' : 'Pré-renderizado em WAV'}${cachedSizeBytes ? ` (${formatBytes(cachedSizeBytes)})` : ''}`
              : 'Pronto para pré-renderizar WAV'}
          </span>
        </div>

        {aiNotes && (
          <p className="mt-2 text-xs text-[#5A6474] dark:text-[#9AA4B2]">
            {aiNotes}
          </p>
        )}

        {/* Mode selector, voice cast trigger & collection pre-render action */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5">
          <div
            role="group"
            aria-label="Modo de leitura"
            className="inline-flex items-center p-1 rounded-xl bg-[#ECECE8] dark:bg-[#191D24]"
          >
            <button
              type="button"
              onClick={() => onModeChange('dramatized')}
              aria-pressed={mode === 'dramatized'}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'dramatized'
                  ? 'bg-white dark:bg-[#252B36] text-[#14171F] dark:text-[#EAECEF] shadow-xs'
                  : 'text-[#5A6474] dark:text-[#9AA4B2] hover:text-[#14171F] dark:hover:text-[#EAECEF]'
              }`}
            >
              Dramatizado
            </button>
            <button
              type="button"
              onClick={() => onModeChange('narrator')}
              aria-pressed={mode === 'narrator'}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'narrator'
                  ? 'bg-white dark:bg-[#252B36] text-[#14171F] dark:text-[#EAECEF] shadow-xs'
                  : 'text-[#5A6474] dark:text-[#9AA4B2] hover:text-[#14171F] dark:hover:text-[#EAECEF]'
              }`}
            >
              Contador único
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {canRefineWithAi && (
              <button
                type="button"
                onClick={onDramatizeChapter}
                disabled={isDramatizing}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300/90 dark:border-neutral-700 text-xs font-medium text-[#14171F] dark:text-[#EAECEF] hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-65"
              >
                {isDramatizing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    <span>Pré-ajustando com IA…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#1E3A5F] dark:text-[#7FA6D6]" aria-hidden="true" />
                    <span>Pré-ajustar falas com IA</span>
                  </>
                )}
              </button>
            )}

            {remainingUncachedCount > 0 && onPrerenderCollection && (
              <button
                type="button"
                onClick={onPrerenderCollection}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-300/90 dark:border-neutral-700 text-xs font-medium text-[#14171F] dark:text-[#EAECEF] hover:bg-neutral-100 dark:hover:bg-neutral-800/80 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-[#1E3A5F] dark:text-[#7FA6D6]" aria-hidden="true" />
                <span>Pré-renderizar lote WAV</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenVoices}
              disabled={!chapter || isLoadingChapter}
              className="min-h-[40px] px-3 py-2 text-xs font-medium text-[#1E3A5F] dark:text-[#7FA6D6] hover:underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
            >
              Elenco e banco ({characterCount})
            </button>
          </div>
        </div>
      </header>

      {/* Fable / fairy tale body with live synchronization and AI vocal directions */}
      {isLoadingChapter || !chapter ? (
        <div
          className="py-10 space-y-4"
          aria-busy="true"
          aria-label="Carregando texto da história"
        >
          <div className="flex items-center gap-2 text-xs text-[#5A6474] dark:text-[#9AA4B2]">
            <Loader2 className="w-4 h-4 animate-spin text-[#1E3A5F] dark:text-[#7FA6D6]" aria-hidden="true" />
            <span>Abrindo fábula pré-ajustada…</span>
          </div>
          <div className="space-y-3 pt-2">
            <div className="h-4 w-full rounded bg-neutral-200/70 dark:bg-neutral-800/70" />
            <div className="h-4 w-11/12 rounded bg-neutral-200/70 dark:bg-neutral-800/70" />
            <div className="h-4 w-4/5 rounded bg-neutral-200/70 dark:bg-neutral-800/70" />
          </div>
        </div>
      ) : (
        <div className="space-y-5" data-testid="chapter-prose">
          {chapter.turns.map((turn, index) => {
            const isActive = index === activeTurnIndex;
            const voiceName = resolveVoiceForTurn(turn, voiceMap, mode, primaryNarratorVoice);
            const canSeek = Boolean(segments[index]) || isLocalSpeechActive;
            const showSpeakerAttribution =
              mode === 'dramatized' &&
              (turn.role === 'character' ||
                index === 0 ||
                chapter.turns[index - 1].speaker !== turn.speaker);

            return (
              <section
                key={turn.id}
                ref={(el) => {
                  turnRefs.current[index] = el;
                }}
                className={`rounded-2xl px-3.5 py-3 -mx-3.5 transition-colors duration-200 ${
                  isActive
                    ? 'bg-[#1E3A5F]/[0.07] dark:bg-[#7FA6D6]/[0.11]'
                    : 'hover:bg-black/[0.025] dark:hover:bg-white/[0.025]'
                }`}
              >
                {showSpeakerAttribution && (
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 text-xs text-[#5A6474] dark:text-[#9AA4B2]">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-[#1E3A5F] dark:text-[#7FA6D6]">
                        {turn.speaker}
                      </span>
                      {turn.style && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="italic truncate text-[#5A6474] dark:text-[#9AA4B2]">
                            {turn.style}
                          </span>
                        </>
                      )}
                    </div>
                    <span className="font-mono-tabular text-[11px] shrink-0">{voiceName}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onSeekToTurn(index)}
                  disabled={!canSeek}
                  aria-label={
                    canSeek
                      ? `Ir para trecho ${index + 1} (${turn.speaker})`
                      : `Trecho ${index + 1} (${turn.speaker})`
                  }
                  className={`w-full text-left font-serif-reading text-[18px] sm:text-[19px] leading-[1.78] text-[#14171F] dark:text-[#E5E8EE] ${
                    turn.role === 'character' ? 'italic' : ''
                  } ${canSeek ? 'cursor-pointer' : 'cursor-default'} focus-visible:outline-2 focus-visible:outline-[#1E3A5F] rounded-lg`}
                >
                  {turn.role === 'character' ? `— ${turn.text}` : turn.text}
                </button>

                {isActive && isPlaying && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[#1E3A5F] dark:text-[#7FA6D6]">
                    <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      Interpretando agora · {turn.speaker} (
                      {isLocalSpeechActive ? 'Voz local' : voiceName})
                    </span>
                  </div>
                )}
              </section>
            );
          })}

          {/* Moral of the fable / fairy tale teaching */}
          {moral && (
            <aside
              aria-label="Moral da história"
              data-testid="fable-moral"
              className="mt-8 p-5 rounded-2xl bg-white/80 dark:bg-[#181C23] border border-neutral-200/80 dark:border-neutral-800"
            >
              <p className="text-xs font-semibold text-[#1E3A5F] dark:text-[#7FA6D6] mb-1.5">
                Moral da história
              </p>
              <p className="font-serif-reading italic text-[17px] leading-relaxed text-[#14171F] dark:text-[#EAECEF]">
                &ldquo;{moral}&rdquo;
              </p>
            </aside>
          )}
        </div>
      )}

      {/* Editorial fable navigation footer */}
      <nav
        aria-label="Navegação entre histórias"
        className="mt-12 pt-6 border-t border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-4"
      >
        <button
          type="button"
          onClick={onPrevChapter}
          disabled={!hasPrevChapter}
          className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#14171F] dark:text-[#EAECEF] disabled:opacity-35 disabled:cursor-not-allowed hover:text-[#1E3A5F] dark:hover:text-[#7FA6D6] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          <span>História anterior</span>
        </button>

        <span className="text-xs text-[#5A6474] dark:text-[#9AA4B2] truncate font-mono-tabular">
          {totalChapters > 1 ? `${chapterPosition} / ${totalChapters}` : book.title}
        </span>

        <button
          type="button"
          onClick={onNextChapter}
          disabled={!hasNextChapter}
          className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#14171F] dark:text-[#EAECEF] disabled:opacity-35 disabled:cursor-not-allowed hover:text-[#1E3A5F] dark:hover:text-[#7FA6D6] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>Próxima história</span>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </nav>
    </article>
  );
}
