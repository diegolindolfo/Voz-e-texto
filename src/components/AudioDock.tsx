import {
  BookOpen,
  Download,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { formatDuration } from '../lib/scriptParser';

interface AudioDockProps {
  hasAudioLoaded: boolean;
  isCachedOnServer: boolean;
  isSynthesizing: boolean;
  synthesisProgressLabel?: string;
  isLocalSpeechActive?: boolean;
  localSpeechTurnLabel?: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  downloadUrl: string | null;
  activeSpeakerLabel?: string;
  onGenerateOrPlay: () => void;
  onTogglePlayPause: () => void;
  onSeek: (seconds: number) => void;
  onSkip: (deltaSec: number) => void;
  onSkipLocalTurn?: (delta: number) => void;
  onStopLocalSpeech?: () => void;
  onCycleSpeed: () => void;
  onOpenChapters: () => void;
  onOpenVoices: () => void;
}

export function AudioDock({
  hasAudioLoaded,
  isCachedOnServer,
  isSynthesizing,
  synthesisProgressLabel,
  isLocalSpeechActive = false,
  localSpeechTurnLabel,
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  downloadUrl,
  activeSpeakerLabel,
  onGenerateOrPlay,
  onTogglePlayPause,
  onSeek,
  onSkip,
  onSkipLocalTurn,
  onStopLocalSpeech,
  onCycleSpeed,
  onOpenChapters,
  onOpenVoices,
}: AudioDockProps) {
  const safeDuration = duration > 0 ? duration : 1;
  const progressPercent = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF]/95 dark:bg-[#14171D]/95 backdrop-blur-md border-t border-neutral-200/90 dark:border-neutral-800 pb-safe"
      data-testid="audio-dock"
    >
      <div className="max-w-6xl mx-auto lg:grid lg:grid-cols-[310px_minmax(0,1fr)] lg:gap-10 lg:px-6">
        <div className="hidden lg:block" aria-hidden="true" />
        <div className="w-full max-w-[66ch] mx-auto px-4 sm:px-8 pt-2 pb-2">
          {isLocalSpeechActive ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 px-1 text-[11px] text-[#5A6474] dark:text-[#9AA4B2]">
                <span className="font-medium text-[#1E3A5F] dark:text-[#7FA6D6] truncate">
                  {localSpeechTurnLabel || 'Voz local do dispositivo'}
                </span>
                <span className="shrink-0">Sem cota de IA</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onCycleSpeed}
                  aria-label={`Velocidade de leitura ${playbackRate}x`}
                  className="min-h-[44px] min-w-[44px] px-2 rounded-xl text-xs font-mono-tabular font-medium text-[#5A6474] dark:text-[#9AA4B2] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  {playbackRate}×
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSkipLocalTurn?.(-1)}
                    aria-label="Trecho anterior"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[#14171F] dark:text-[#EAECEF] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <SkipBack className="w-[18px] h-[18px]" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={onTogglePlayPause}
                    aria-label={isPlaying ? 'Pausar voz local' : 'Retomar voz local'}
                    className="h-11 w-11 flex items-center justify-center rounded-full bg-[#1E3A5F] dark:bg-[#7FA6D6] text-white dark:text-[#101216] hover:bg-[#162C49] dark:hover:bg-[#93B6E0] active:scale-95 transition-transform cursor-pointer"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 fill-current" aria-hidden="true" />
                    ) : (
                      <Play className="w-5 h-5 fill-current ml-0.5" aria-hidden="true" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onSkipLocalTurn?.(1)}
                    aria-label="Próximo trecho"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[#14171F] dark:text-[#EAECEF] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <SkipForward className="w-[18px] h-[18px]" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onOpenVoices}
                    aria-label="Abrir vozes e cache WAV"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#5A6474] dark:text-[#9AA4B2] hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-[#14171F] dark:hover:text-[#EAECEF] transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="w-[18px] h-[18px]" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={onStopLocalSpeech}
                    aria-label="Encerrar leitura com voz local"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#5A6474] dark:text-[#9AA4B2] hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-[#14171F] dark:hover:text-[#EAECEF] transition-colors cursor-pointer"
                  >
                    <X className="w-[18px] h-[18px]" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ) : hasAudioLoaded ? (
            <div className="space-y-1.5">
              {/* Tactile progress scrubber */}
              <div className="flex items-center gap-3">
                <span className="font-mono-tabular text-[11px] text-[#5A6474] dark:text-[#9AA4B2] w-10 shrink-0">
                  {formatDuration(currentTime)}
                </span>

                <div className="relative flex-1 flex items-center h-6">
                  <div className="w-full h-1 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden pointer-events-none">
                    <div
                      className="h-full bg-[#1E3A5F] dark:bg-[#7FA6D6]"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={safeDuration}
                    step={0.1}
                    value={Math.min(currentTime, safeDuration)}
                    onChange={(e) => onSeek(Number(e.target.value))}
                    aria-label="Progresso do áudio da fábula"
                    className="audio-scrubber absolute inset-0 w-full h-full opacity-100"
                  />
                </div>

                <span className="font-mono-tabular text-[11px] text-[#5A6474] dark:text-[#9AA4B2] w-10 text-right shrink-0">
                  {formatDuration(duration)}
                </span>
              </div>

              {/* Compact ergonomic playback bar */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onCycleSpeed}
                    aria-label={`Velocidade de leitura ${playbackRate}x`}
                    className="min-h-[44px] min-w-[44px] px-2 rounded-xl text-xs font-mono-tabular font-medium text-[#5A6474] dark:text-[#9AA4B2] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    {playbackRate}×
                  </button>
                  {activeSpeakerLabel && (
                    <span className="hidden sm:inline text-xs text-[#5A6474] dark:text-[#9AA4B2] truncate max-w-[180px]">
                      {activeSpeakerLabel}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSkip(-15)}
                    aria-label="Voltar 15 segundos"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[#14171F] dark:text-[#EAECEF] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-[18px] h-[18px]" aria-hidden="true" />
                  </button>

                  <button
                    type="button"
                    onClick={onTogglePlayPause}
                    aria-label={isPlaying ? 'Pausar narração' : 'Reproduzir narração'}
                    className="h-11 w-11 flex items-center justify-center rounded-full bg-[#1E3A5F] dark:bg-[#7FA6D6] text-white dark:text-[#101216] hover:bg-[#162C49] dark:hover:bg-[#93B6E0] active:scale-95 transition-transform cursor-pointer"
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5 fill-current" aria-hidden="true" />
                    ) : (
                      <Play className="w-5 h-5 fill-current ml-0.5" aria-hidden="true" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onSkip(15)}
                    aria-label="Avançar 15 segundos"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[#14171F] dark:text-[#EAECEF] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <RotateCw className="w-[18px] h-[18px]" aria-hidden="true" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {downloadUrl && (
                    <a
                      href={`${downloadUrl}?download=1`}
                      download
                      aria-label="Baixar arquivo WAV pré-renderizado"
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#5A6474] dark:text-[#9AA4B2] hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-[#14171F] dark:hover:text-[#EAECEF] transition-colors"
                    >
                      <Download className="w-[18px] h-[18px]" aria-hidden="true" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={onOpenVoices}
                    aria-label="Abrir vozes e cache WAV"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#5A6474] dark:text-[#9AA4B2] hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-[#14171F] dark:hover:text-[#EAECEF] transition-colors cursor-pointer"
                  >
                    <SlidersHorizontal className="w-[18px] h-[18px]" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Single-row minimalist thumb CTA when audio hasn't started yet */
            <div className="flex items-center gap-2.5 py-0.5">
              <button
                type="button"
                onClick={onOpenChapters}
                aria-label="Abrir lista de fábulas e contos"
                className="lg:hidden min-h-[46px] min-w-[46px] flex items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800 text-[#14171F] dark:text-[#EAECEF] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
              >
                <BookOpen className="w-5 h-5" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onGenerateOrPlay}
                disabled={isSynthesizing}
                className="flex-1 min-h-[46px] px-5 py-2.5 rounded-xl bg-[#1E3A5F] dark:bg-[#7FA6D6] text-white dark:text-[#101216] text-sm font-semibold flex items-center justify-center gap-2.5 hover:bg-[#162C49] dark:hover:bg-[#93B6E0] disabled:opacity-75 active:scale-[0.99] transition-all whitespace-nowrap cursor-pointer"
              >
                {isSynthesizing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {synthesisProgressLabel || 'Pré-renderizando vozes…'}
                    </span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current shrink-0" aria-hidden="true" />
                    <span>
                      {isCachedOnServer ? 'Ouvir pré-renderizado (.wav)' : 'Ouvir história'}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onOpenVoices}
                aria-label="Configurar vozes e cache"
                className="min-h-[46px] min-w-[46px] flex items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800 text-[#14171F] dark:text-[#EAECEF] hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer shrink-0"
              >
                <SlidersHorizontal className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
