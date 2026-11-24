import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Layers,
  Loader2,
  Maximize2,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  AudioSegmentTiming,
  BookCatalogItem,
  Chapter,
  ChapterSummary,
  PrebuiltVoiceName,
  ReadingMode,
} from '../types';
import { getStoryIllustration } from '../data/storyIllustrations';
import { formatBytes, formatDuration, resolveVoiceForTurn } from '../lib/scriptParser';

interface ChapterReaderProps {
  book: BookCatalogItem;
  chapter: Chapter | null;
  chapterSummary?: ChapterSummary;
  chapterPosition: number;
  totalChapters: number;
  isCuratorMode?: boolean;
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
  cachedStorageSource?: 'firebase-storage' | 'firestore' | 'static' | 'local-server';
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
  isCuratorMode = false,
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
  const [failedIllustrationSrc, setFailedIllustrationSrc] = useState<string | null>(null);
  const [lightboxStoryKey, setLightboxStoryKey] = useState<string | null>(null);

  const activeStoryKey = chapter?.id ?? chapterSummary?.id ?? null;
  const lightboxOpen = Boolean(activeStoryKey && lightboxStoryKey === activeStoryKey);

  const primaryNarratorVoice =
    (chapter && voiceMap[chapter.characters[0]?.name]) ??
    chapter?.characters[0]?.defaultVoice ??
    'Charon';

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxStoryKey(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen]);

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
    isCuratorMode && chapter && !isLoadingChapter && !chapter.dramatizedByAi && onDramatizeChapter,
  );

  const illustration = getStoryIllustration(
    chapter?.id ?? chapterSummary?.id,
    chapter?.illustrationUrl ?? chapterSummary?.illustrationUrl,
  );
  const showIllustration = Boolean(illustration && failedIllustrationSrc !== illustration.src);

  return (
    <article className="w-full max-w-[68ch] mx-auto px-5 sm:px-8 pt-4 pb-32 lg:pt-7 lg:pb-28">
      {/* Clean editorial storybook header */}
      <header className="mb-6 pb-5 border-b border-neutral-200/80 dark:border-neutral-800">
        <p className="lg:hidden text-xs font-medium text-[#5A6474] dark:text-[#9AA4B2] mb-2 truncate">
          {book.title} · {book.author}
        </p>

        <p
          className="text-xs font-medium text-[#1E3A5F] dark:text-[#7FA6D6] tracking-wide mb-1.5 font-mono-tabular"
          data-testid="chapter-position"
        >
          {numberLabel}
          {totalChapters > 1 ? ` · ${chapterPosition} de ${totalChapters}` : ''}
          {cachedDurationSec
            ? ` · ${formatDuration(cachedDurationSec)}`
            : estimatedMinutes
              ? ` · ~${estimatedMinutes} min`
              : ''}
        </p>

        <h1 className="font-editorial text-[1.85rem] sm:text-[2.3rem] font-semibold tracking-tight text-[#14171F] dark:text-[#EAECEF] leading-[1.14]">
          {title}
        </h1>

        {isCuratorMode && (
          <>
            {chapter?.summary && (
              <p className="mt-3 text-sm leading-relaxed text-[#5A6474] dark:text-[#9AA4B2]">
                {chapter.summary}
              </p>
            )}

            <div
              className="mt-3.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5A6474] dark:text-[#9AA4B2]"
              data-testid="chapter-metadata"
            >
              <span className="text-[#1E3A5F] dark:text-[#7FA6D6] font-medium">
                {chapter?.dramatizedByAi ? 'Pré-ajustado por IA' : 'Texto integral'}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {uniqueVoiceCount === 1
                  ? '1 voz natural'
                  : `${uniqueVoiceCount} vozes naturais`}
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
                  ? `${
                      cachedStorageSource === 'firebase-storage'
                        ? 'Salvo no Firebase Storage'
                        : cachedStorageSource === 'firestore'
                          ? 'Salvo no banco Firestore'
                          : 'Pré-renderizado em MP3'
                    }${cachedSizeBytes ? ` (${formatBytes(cachedSizeBytes)})` : ''}`
                  : 'Pronto para pré-renderizar MP3'}
              </span>
            </div>

            {aiNotes && (
              <p className="mt-2 text-xs text-[#5A6474] dark:text-[#9AA4B2]">
                {aiNotes}
              </p>
            )}

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
                    <span>Pré-renderizar lote MP3</span>
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
          </>
        )}
      </header>

      {/* Pre-rendered storybook watercolor illustration */}
      {illustration && showIllustration && (
        <figure className="mb-7">
          <button
            type="button"
            onClick={() => setLightboxStoryKey(activeStoryKey)}
            aria-label={`Ampliar ilustração de ${title}`}
            className="group relative block w-full overflow-hidden rounded-2xl border border-neutral-200/80 dark:border-neutral-800/80 bg-[#ECEAE4] dark:bg-[#181B22] focus-visible:outline-2 focus-visible:outline-[#1E3A5F] cursor-zoom-in"
          >
            <img
              src={illustration.src}
              alt={illustration.alt}
              loading="eager"
              onError={() => setFailedIllustrationSrc(illustration.src)}
              className="w-full aspect-[16/9] max-h-[240px] sm:max-h-[290px] object-cover transition-transform duration-300 group-hover:scale-[1.01]"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-2.5 right-2.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/45 text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </span>
          </button>
        </figure>
      )}

      {/* Literary storybook body */}
      {isLoadingChapter || !chapter ? (
        <div
          className="py-10 space-y-4"
          aria-busy="true"
          aria-label="Carregando texto da história"
        >
          <div className="flex items-center gap-2 text-xs text-[#5A6474] dark:text-[#9AA4B2]">
            <Loader2 className="w-4 h-4 animate-spin text-[#1E3A5F] dark:text-[#7FA6D6]" aria-hidden="true" />
            <span>Abrindo história…</span>
          </div>
          <div className="space-y-3 pt-2">
            <div className="h-4 w-full rounded bg-neutral-200/70 dark:bg-neutral-800/70" />
            <div className="h-4 w-11/12 rounded bg-neutral-200/70 dark:bg-neutral-800/70" />
            <div className="h-4 w-4/5 rounded bg-neutral-200/70 dark:bg-neutral-800/70" />
          </div>
        </div>
      ) : (
        <div className="space-y-3" data-testid="chapter-prose">
          {chapter.turns.map((turn, index) => {
            const isActive = index === activeTurnIndex;
            const voiceName = resolveVoiceForTurn(turn, voiceMap, mode, primaryNarratorVoice);
            const canSeek = Boolean(segments[index]) || isLocalSpeechActive;
            const speakerChanged = index === 0 || chapter.turns[index - 1].speaker !== turn.speaker;
            const showCuratorMeta =
              isCuratorMode &&
              mode === 'dramatized' &&
              (turn.role === 'character' || speakerChanged);
            const showReaderCharacterLabel =
              !isCuratorMode &&
              mode === 'dramatized' &&
              turn.role === 'character' &&
              speakerChanged;

            return (
              <section
                key={turn.id}
                ref={(el) => {
                  turnRefs.current[index] = el;
                }}
                className={`rounded-xl px-3 py-1.5 -mx-3 transition-colors duration-200 border-l-2 ${
                  isActive
                    ? 'border-[#1E3A5F] dark:border-[#7FA6D6] bg-[#1E3A5F]/[0.06] dark:bg-[#7FA6D6]/[0.10]'
                    : 'border-transparent hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                }`}
              >
                {showCuratorMeta && (
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1 text-xs text-[#5A6474] dark:text-[#9AA4B2]">
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

                {showReaderCharacterLabel && (
                  <p className="text-[11px] font-semibold tracking-wide uppercase text-[#1E3A5F]/85 dark:text-[#7FA6D6]/90 mb-0.5">
                    {turn.speaker}
                  </p>
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
                  className={`w-full text-left font-serif-reading text-[19px] sm:text-[20px] leading-[1.8] text-[#14171F] dark:text-[#E5E8EE] ${
                    turn.role === 'character' ? 'italic' : ''
                  } ${canSeek ? 'cursor-pointer' : 'cursor-default'} focus-visible:outline-2 focus-visible:outline-[#1E3A5F] rounded-lg`}
                >
                  {turn.role === 'character' ? `— ${turn.text}` : turn.text}
                </button>
              </section>
            );
          })}

          {/* Moral of the fable / fairy tale teaching */}
          {moral && (
            <aside
              aria-label="Moral da história"
              data-testid="fable-moral"
              className="mt-8 pl-4 py-1 border-l-2 border-[#1E3A5F]/40 dark:border-[#7FA6D6]/50"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1E3A5F] dark:text-[#7FA6D6] mb-1">
                Moral da história
              </p>
              <p className="font-serif-reading italic text-[18px] leading-relaxed text-[#14171F] dark:text-[#EAECEF]">
                &ldquo;{moral}&rdquo;
              </p>
            </aside>
          )}
        </div>
      )}

      {/* Lightbox for full-size illustration */}
      {lightboxOpen && illustration && showIllustration && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Ilustração ampliada de ${title}`}
          onClick={() => setLightboxStoryKey(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-xs"
        >
          <div
            className="relative max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxStoryKey(null)}
              aria-label="Fechar ilustração"
              className="absolute -top-11 right-0 min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
            <img
              src={illustration.src}
              alt={illustration.alt}
              className="w-full max-h-[84vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
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
