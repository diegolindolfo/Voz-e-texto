import { useEffect } from 'react';
import {
  AlertCircle,
  Check,
  Clock,
  Cloud,
  CloudUpload,
  Database,
  Download,
  Layers,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import { AVAILABLE_VOICES } from '../data/books';
import { canUserDeleteFirestoreRecord } from '../lib/prerenderedAudioStore';
import { formatBytes, formatDuration } from '../lib/scriptParser';
import type {
  CachedAudioMetadata,
  CacheInventoryResponse,
  Chapter,
  PrebuiltVoiceName,
  ReadingMode,
  TtsStatusResponse,
} from '../types';

const PACING_OPTIONS: Array<{ seconds: number; label: string; hint: string }> = [
  { seconds: 2, label: 'Normal', hint: '2s' },
  { seconds: 8, label: 'Moderado', hint: '8s' },
  { seconds: 20, label: 'Econômico', hint: '20s' },
];

interface VoicesCacheSheetProps {
  open: boolean;
  onClose: () => void;
  chapter: Chapter;
  mode: ReadingMode;
  onModeChange: (mode: ReadingMode) => void;
  voiceMap: Record<string, PrebuiltVoiceName>;
  onVoiceChange: (speaker: string, voice: PrebuiltVoiceName) => void;
  currentCacheKey: string;
  isCurrentCached: boolean;
  isSynthesizing: boolean;
  onRegenerateCurrent: () => void;
  cacheInventory: CacheInventoryResponse;
  firestoreKeys: Set<string>;
  authUser: User | null;
  authReady: boolean;
  isSigningIn: boolean;
  isAdmin: boolean;
  isCuratorMode: boolean;
  onToggleCuratorMode: () => void;
  dbSyncLabel: string | null;
  onSignInGoogle: () => void;
  onSignOutGoogle: () => void;
  onSyncAllToFirestore: () => void;
  onSaveItemToFirestore: (item: CachedAudioMetadata) => void;
  onDownloadCacheItem: (item: CachedAudioMetadata) => void;
  onDeleteCacheItem: (cacheKey: string) => void;
  ttsStatus: TtsStatusResponse;
  remainingUncachedCount: number;
  onEnqueueNextChapters: (count: number) => void;
  onSetPacingSec: (seconds: number) => void;
  onClearQueue: () => void;
  browserSpeechSupported: boolean;
  isLocalSpeechActive: boolean;
  onToggleLocalSpeech: () => void;
}

export function VoicesCacheSheet({
  open,
  onClose,
  chapter,
  mode,
  onModeChange,
  voiceMap,
  onVoiceChange,
  currentCacheKey,
  isCurrentCached,
  isSynthesizing,
  onRegenerateCurrent,
  cacheInventory,
  firestoreKeys,
  authUser,
  authReady,
  isSigningIn,
  isAdmin,
  isCuratorMode,
  onToggleCuratorMode,
  dbSyncLabel,
  onSignInGoogle,
  onSignOutGoogle,
  onSyncAllToFirestore,
  onSaveItemToFirestore,
  onDownloadCacheItem,
  onDeleteCacheItem,
  ttsStatus,
  remainingUncachedCount,
  onEnqueueNextChapters,
  onSetPacingSec,
  onClearQueue,
  browserSpeechSupported,
  isLocalSpeechActive,
  onToggleLocalSpeech,
}: VoicesCacheSheetProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const activeJob = ttsStatus.activeJob;
  const hasQueueItems = ttsStatus.queue.length > 0;
  const firestoreCount = cacheInventory.items.filter((item) => firestoreKeys.has(item.cacheKey)).length;
  const unsyncedCount = cacheInventory.items.filter((item) => !firestoreKeys.has(item.cacheKey)).length;
  const isSyncingDb = Boolean(dbSyncLabel);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={isCuratorMode ? 'Elenco de vozes e banco de áudios pré-renderizados' : 'Vozes da história'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full sm:max-w-lg max-h-[88vh] bg-[#F7F7F5] dark:bg-[#14171D] rounded-t-3xl sm:rounded-3xl border-t sm:border border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden">
        <div className="pt-3 pb-2.5 px-5 border-b border-neutral-200/80 dark:border-neutral-800">
          <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700 mx-auto mb-3 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-editorial text-lg font-semibold text-[#14171F] dark:text-[#EAECEF]">
                {isCuratorMode ? 'Vozes e banco de pré-renderizados' : 'Vozes da história'}
              </h2>
              <p className="text-xs text-[#5A6474] dark:text-[#9AA4B2]">
                {chapter.numberLabel} — {chapter.title}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar painel de vozes"
              className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-full text-[#5A6474] dark:text-[#9AA4B2] hover:bg-neutral-200/60 dark:hover:bg-neutral-800 cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-5 space-y-7 pb-safe">
          {/* 1. Reading mode selector (always visible) */}
          <section>
            <h3 className="text-xs font-semibold text-[#5A6474] dark:text-[#9AA4B2] mb-2.5">
              Modo de contação
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onModeChange('dramatized')}
                aria-pressed={mode === 'dramatized'}
                className={`min-h-[54px] p-3 rounded-2xl text-left border transition-colors cursor-pointer ${
                  mode === 'dramatized'
                    ? 'bg-white dark:bg-[#1D222B] border-[#1E3A5F] dark:border-[#7FA6D6]'
                    : 'bg-transparent border-neutral-200 dark:border-neutral-800 hover:bg-white/60 dark:hover:bg-white/[0.03]'
                }`}
              >
                <p className="text-sm font-semibold text-[#14171F] dark:text-[#EAECEF]">
                  Dramatizado
                </p>
                <p className="text-xs text-[#5A6474] dark:text-[#9AA4B2] mt-0.5">
                  Uma voz natural para cada personagem
                </p>
              </button>

              <button
                type="button"
                onClick={() => onModeChange('narrator')}
                aria-pressed={mode === 'narrator'}
                className={`min-h-[54px] p-3 rounded-2xl text-left border transition-colors cursor-pointer ${
                  mode === 'narrator'
                    ? 'bg-white dark:bg-[#1D222B] border-[#1E3A5F] dark:border-[#7FA6D6]'
                    : 'bg-transparent border-neutral-200 dark:border-neutral-800 hover:bg-white/60 dark:hover:bg-white/[0.03]'
                }`}
              >
                <p className="text-sm font-semibold text-[#14171F] dark:text-[#EAECEF]">
                  Contador único
                </p>
                <p className="text-xs text-[#5A6474] dark:text-[#9AA4B2] mt-0.5">
                  Leitura contínua do Contador de Histórias
                </p>
              </button>
            </div>
          </section>

          {/* 2. Cast voices (always visible) */}
          <section>
            <h3 className="text-xs font-semibold text-[#5A6474] dark:text-[#9AA4B2] mb-2.5">
              {isCuratorMode ? 'Elenco pré-ajustado por IA' : 'Vozes dos personagens'}
            </h3>
            <div className="divide-y divide-neutral-200/80 dark:divide-neutral-800 border-t border-b border-neutral-200/80 dark:border-neutral-800">
              {chapter.characters.map((character, idx) => {
                const disabled = mode === 'narrator' && idx > 0;
                const currentVoice = voiceMap[character.name] ?? character.defaultVoice;
                const selectId = `voice-select-${idx}`;

                return (
                  <div
                    key={character.name}
                    className={`py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4 ${
                      disabled ? 'opacity-45' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <label
                        htmlFor={selectId}
                        className="block text-sm font-medium text-[#14171F] dark:text-[#EAECEF]"
                      >
                        {character.name}
                      </label>
                      <p className="text-xs text-[#5A6474] dark:text-[#9AA4B2] mt-0.5 leading-snug">
                        {character.description}
                      </p>
                    </div>

                    <select
                      id={selectId}
                      disabled={disabled}
                      value={currentVoice}
                      onChange={(e) =>
                        onVoiceChange(character.name, e.target.value as PrebuiltVoiceName)
                      }
                      aria-label={`Voz para ${character.name}`}
                      className="w-full sm:w-auto min-h-[44px] px-3 py-2 rounded-xl bg-white dark:bg-[#1D222B] border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-[#14171F] dark:text-[#EAECEF] shrink-0 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {AVAILABLE_VOICES.map((voice) => (
                        <option key={voice.name} value={voice.name}>
                          {voice.label} · {voice.timbre}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
            {isCuratorMode && (
              <p className="mt-2.5 text-xs text-[#5A6474] dark:text-[#9AA4B2]">
                Cada combinação de fábula e elenco gera uma chave única de registro.
                Alterar uma voz preserva os registros já salvos.
              </p>
            )}
          </section>

          {/* 3. Zero-quota instant browser voice fallback (always visible) */}
          {browserSpeechSupported && (
            <section>
              <h3 className="text-xs font-semibold text-[#5A6474] dark:text-[#9AA4B2] mb-2.5">
                Leitura instantânea no dispositivo
              </h3>
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1D222B] border border-neutral-200/80 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#14171F] dark:text-[#EAECEF]">
                    Voz local do dispositivo
                  </p>
                  <p className="text-xs text-[#5A6474] dark:text-[#9AA4B2] mt-0.5 leading-snug">
                    Lê a história imediatamente em português usando o sintetizador do próprio aparelho.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onToggleLocalSpeech}
                  className={`w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    isLocalSpeechActive
                      ? 'bg-[#1E3A5F] dark:bg-[#7FA6D6] text-white dark:text-[#101216]'
                      : 'border border-neutral-300 dark:border-neutral-700 text-[#14171F] dark:text-[#EAECEF] hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isLocalSpeechActive ? 'Parar voz local' : 'Ouvir com voz local'}</span>
                </button>
              </div>
            </section>
          )}

          {/* Curator-only sections: Cloud Sync, Batch Queue, and Inventory */}
          {isCuratorMode && (
            <>
              {/* Cloud Storage + Firestore Sync Section */}
              <section data-testid="firestore-db-section">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <h3 className="text-xs font-semibold text-[#5A6474] dark:text-[#9AA4B2] inline-flex items-center gap-1.5 min-w-0">
                    <Database className="w-3.5 h-3.5 shrink-0 text-[#1E3A5F] dark:text-[#7FA6D6]" aria-hidden="true" />
                    <span className="truncate">Firebase Storage + Firestore</span>
                  </h3>
                  <span className="font-mono-tabular text-[11px] text-[#5A6474] dark:text-[#9AA4B2] whitespace-nowrap shrink-0">
                    {firestoreCount} na nuvem · {cacheInventory.count} total
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1D222B] border border-neutral-200/80 dark:border-neutral-800 space-y-3">
                  {dbSyncLabel && (
                    <div className="p-2.5 rounded-xl bg-[#F7F7F5] dark:bg-[#14171D] border border-neutral-200/80 dark:border-neutral-800 flex items-center gap-2 text-xs text-[#1E3A5F] dark:text-[#7FA6D6]">
                      <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
                      <span className="truncate font-medium">{dbSyncLabel}</span>
                    </div>
                  )}

                  {unsyncedCount > 0 ? (
                    <button
                      type="button"
                      onClick={onSyncAllToFirestore}
                      disabled={isSyncingDb}
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#1E3A5F] dark:bg-[#7FA6D6] text-white dark:text-[#101216] text-xs font-semibold hover:bg-[#162C49] dark:hover:bg-[#93B6E0] inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60"
                    >
                      <CloudUpload className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>
                        Enviar {unsyncedCount}{' '}
                        {unsyncedCount === 1 ? 'áudio local para a nuvem' : 'áudios locais para a nuvem'}
                      </span>
                    </button>
                  ) : (
                    <p className="text-xs text-[#5A6474] dark:text-[#9AA4B2]">
                      Todos os áudios pré-renderizados estão sincronizados com a nuvem.
                    </p>
                  )}
                </div>
              </section>

              {/* Background pre-rendering MP3 queue */}
              <section data-testid="prewarm-queue-section">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <h3 className="text-xs font-semibold text-[#5A6474] dark:text-[#9AA4B2]">
                    Fila de pré-renderização (.mp3)
                  </h3>
                  <span className="font-mono-tabular text-[11px] text-[#5A6474] dark:text-[#9AA4B2]">
                    Ritmo: {ttsStatus.pacingSec}s
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1D222B] border border-neutral-200/80 dark:border-neutral-800 space-y-3.5">
                  <div>
                    <p className="text-xs font-medium text-[#14171F] dark:text-[#EAECEF] mb-2">
                      Cadência entre sínteses
                    </p>
                    <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Cadência da fila">
                      {PACING_OPTIONS.map((opt) => {
                        const selected =
                          (opt.seconds === 2 && ttsStatus.pacingSec <= 4) ||
                          (opt.seconds === 8 && ttsStatus.pacingSec > 4 && ttsStatus.pacingSec <= 12) ||
                          (opt.seconds === 20 && ttsStatus.pacingSec > 12);
                        return (
                          <button
                            key={opt.seconds}
                            type="button"
                            onClick={() => onSetPacingSec(opt.seconds)}
                            aria-pressed={selected}
                            className={`min-h-[44px] px-2 py-2 rounded-xl border text-center transition-colors cursor-pointer ${
                              selected
                                ? 'border-[#1E3A5F] dark:border-[#7FA6D6] bg-[#1E3A5F]/[0.07] dark:bg-[#7FA6D6]/[0.12] text-[#1E3A5F] dark:text-[#7FA6D6]'
                                : 'border-neutral-200 dark:border-neutral-700 text-[#5A6474] dark:text-[#9AA4B2] hover:bg-neutral-100/70 dark:hover:bg-neutral-800/70'
                            }`}
                          >
                            <span className="block text-xs font-semibold">{opt.label}</span>
                            <span className="block font-mono-tabular text-[11px] opacity-80">
                              {opt.hint}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEnqueueNextChapters(3)}
                      disabled={remainingUncachedCount === 0}
                      className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-[#14171F] dark:text-[#EAECEF] hover:bg-neutral-100 dark:hover:bg-neutral-800 inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      <Layers className="w-3.5 h-3.5 text-[#1E3A5F] dark:text-[#7FA6D6]" aria-hidden="true" />
                      <span>Próximas 3 histórias</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEnqueueNextChapters(6)}
                      disabled={remainingUncachedCount === 0}
                      className="flex-1 min-h-[44px] px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-medium text-[#14171F] dark:text-[#EAECEF] hover:bg-neutral-100 dark:hover:bg-neutral-800 inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      <Layers className="w-3.5 h-3.5 text-[#1E3A5F] dark:text-[#7FA6D6]" aria-hidden="true" />
                      <span>Toda a coleção</span>
                    </button>
                  </div>

                  {ttsStatus.dailyQuotaPaused && (
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                      <span>
                        {ttsStatus.dailyQuotaMessage ||
                          'Fila pausada automaticamente por limite de cota diária.'}
                      </span>
                    </div>
                  )}

                  {activeJob && (
                    <div className="p-2.5 rounded-xl bg-[#F7F7F5] dark:bg-[#14171D] border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Loader2
                          className="w-3.5 h-3.5 animate-spin text-[#1E3A5F] dark:text-[#7FA6D6] shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate font-medium text-[#14171F] dark:text-[#EAECEF]">
                          {activeJob.chapterTitle}
                        </span>
                      </div>
                      <span className="font-mono-tabular text-[11px] text-[#1E3A5F] dark:text-[#7FA6D6] shrink-0">
                        {activeJob.state === 'waiting_retry' && activeJob.waitingRetrySec
                          ? `Aguardando (${activeJob.waitingRetrySec}s)`
                          : `Parte ${Math.min(activeJob.completedBatches + 1, activeJob.totalBatches)}/${activeJob.totalBatches}`}
                      </span>
                    </div>
                  )}

                  {hasQueueItems && (
                    <div className="pt-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-[#5A6474] dark:text-[#9AA4B2]">
                          Histórias na fila ({ttsStatus.queue.length})
                        </span>
                        <button
                          type="button"
                          onClick={onClearQueue}
                          className="text-[11px] font-medium text-[#1E3A5F] dark:text-[#7FA6D6] hover:underline cursor-pointer"
                        >
                          Limpar fila
                        </button>
                      </div>
                      <ul className="divide-y divide-neutral-200/70 dark:divide-neutral-800 border-t border-neutral-200/70 dark:border-neutral-800 max-h-40 overflow-y-auto">
                        {ttsStatus.queue.map((item) => (
                          <li
                            key={item.id}
                            className="py-2 flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="truncate text-[#14171F] dark:text-[#EAECEF]">
                              {item.chapterTitle}
                            </span>
                            <span className="inline-flex items-center gap-1 shrink-0 font-mono-tabular text-[11px] text-[#5A6474] dark:text-[#9AA4B2]">
                              {item.status === 'running' && (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin text-[#1E3A5F] dark:text-[#7FA6D6]" />
                                  <span>Renderizando</span>
                                </>
                              )}
                              {item.status === 'queued' && (
                                <>
                                  <Clock className="w-3 h-3" />
                                  <span>Na fila</span>
                                </>
                              )}
                              {item.status === 'done' && (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  <span>Pré-renderizado</span>
                                </>
                              )}
                              {item.status === 'failed' && (
                                <span className="text-red-600 dark:text-red-400">Pausado</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>

              {/* Audio Inventory & Cloud Manager */}
              <section data-testid="wav-inventory-section">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <h3 className="text-xs font-semibold text-[#5A6474] dark:text-[#9AA4B2]">
                    Histórias pré-renderizadas (.mp3 / .wav)
                  </h3>
                  <span className="font-mono-tabular text-xs text-[#5A6474] dark:text-[#9AA4B2]">
                    {cacheInventory.count}{' '}
                    {cacheInventory.count === 1 ? 'registro' : 'registros'} ·{' '}
                    {formatBytes(cacheInventory.totalSizeBytes)}
                  </span>
                </div>

                {isCurrentCached && (
                  <div className="mb-3 p-3.5 rounded-2xl bg-white dark:bg-[#1D222B] border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#14171F] dark:text-[#EAECEF]">
                        História atual pré-renderizada
                      </p>
                      <p className="text-xs text-[#5A6474] dark:text-[#9AA4B2] mt-0.5">
                        {firestoreKeys.has(currentCacheKey)
                          ? 'Armazenada na nuvem (Firebase Storage) para reprodução em qualquer dispositivo.'
                          : 'Disponível em cache estático ou local.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onRegenerateCurrent}
                      disabled={isSynthesizing}
                      className="min-h-[40px] px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-[#14171F] dark:text-[#EAECEF] hover:bg-neutral-100 dark:hover:bg-neutral-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Regerar</span>
                    </button>
                  </div>
                )}

                {cacheInventory.items.length === 0 ? (
                  <p className="text-xs text-[#5A6474] dark:text-[#9AA4B2] py-3">
                    Nenhum áudio pré-renderizado armazenado ainda.
                  </p>
                ) : (
                  <ul className="divide-y divide-neutral-200/80 dark:divide-neutral-800 border-t border-b border-neutral-200/80 dark:border-neutral-800">
                    {cacheInventory.items.map((item) => {
                      const isCurrent = item.cacheKey === currentCacheKey;
                      const inFirestore = firestoreKeys.has(item.cacheKey);
                      const canDelete = !inFirestore || canUserDeleteFirestoreRecord(item, authUser);
                      const sourceLabel =
                        item.storageSource === 'firebase-storage'
                          ? 'Firebase Storage'
                          : item.storageSource === 'firestore'
                            ? `Firestore (${item.chunkCount ?? 0} blocos)`
                            : item.storageSource === 'static'
                              ? 'Estático (.mp3)'
                              : 'Cache local';

                      return (
                        <li
                          key={item.cacheKey}
                          className="py-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#14171F] dark:text-[#EAECEF] truncate">
                              {item.chapterTitle}
                              {isCurrent ? ' (atual)' : ''}
                            </p>
                            <p className="text-xs text-[#5A6474] dark:text-[#9AA4B2] font-mono-tabular mt-0.5 flex flex-wrap items-center gap-x-1.5">
                              <span
                                className={
                                  inFirestore
                                    ? 'text-[#1E3A5F] dark:text-[#7FA6D6] font-medium inline-flex items-center gap-1'
                                    : ''
                                }
                              >
                                {inFirestore && <Cloud className="w-3 h-3 inline" aria-hidden="true" />}
                                {sourceLabel}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{formatDuration(item.durationSec)}</span>
                              <span aria-hidden="true">·</span>
                              <span>{formatBytes(item.fileSizeBytes)}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {!inFirestore && authUser && (
                              <button
                                type="button"
                                onClick={() => onSaveItemToFirestore(item)}
                                disabled={isSyncingDb}
                                aria-label={`Salvar ${item.chapterTitle} na nuvem`}
                                title="Salvar no Firebase Storage"
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#1E3A5F] dark:text-[#7FA6D6] hover:bg-neutral-200/60 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-45"
                              >
                                <CloudUpload className="w-4 h-4" aria-hidden="true" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onDownloadCacheItem(item)}
                              aria-label={`Baixar áudio de ${item.chapterTitle}`}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#5A6474] dark:text-[#9AA4B2] hover:bg-neutral-200/60 dark:hover:bg-neutral-800 cursor-pointer"
                            >
                              <Download className="w-4 h-4" aria-hidden="true" />
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => onDeleteCacheItem(item.cacheKey)}
                                disabled={isSyncingDb}
                                aria-label={`Remover áudio de ${item.chapterTitle}`}
                                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#5A6474] dark:text-[#9AA4B2] hover:text-red-600 dark:hover:text-red-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-45"
                              >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}

          {/* 4. Discrete Google account & Curator Mode toggle at the bottom */}
          <section className="pt-2 border-t border-neutral-200/80 dark:border-neutral-800">
            <h3 className="text-xs font-semibold text-[#5A6474] dark:text-[#9AA4B2] mb-2.5">
              Conta Google
            </h3>
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1D222B] border border-neutral-200/80 dark:border-neutral-800 space-y-3">
              {!authReady ? (
                <div className="flex items-center gap-2 text-xs text-[#5A6474] dark:text-[#9AA4B2]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>Verificando sessão…</span>
                </div>
              ) : authUser ? (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#14171F] dark:text-[#EAECEF] truncate">
                        {authUser.displayName || 'Conta Google conectada'}
                      </p>
                      <p className="text-xs text-[#5A6474] dark:text-[#9AA4B2] mt-0.5 leading-snug">
                        {isAdmin
                          ? 'Administrador verificado.'
                          : 'Conectado para gerar novas narrações com IA.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onSignOutGoogle}
                      disabled={isSyncingDb}
                      aria-label="Sair da conta Google"
                      className="min-h-[40px] px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-medium text-[#5A6474] dark:text-[#9AA4B2] hover:text-[#14171F] dark:hover:text-[#EAECEF] hover:bg-neutral-100 dark:hover:bg-neutral-800 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Sair</span>
                    </button>
                  </div>

                  {isAdmin && (
                    <button
                      type="button"
                      onClick={onToggleCuratorMode}
                      aria-pressed={isCuratorMode}
                      className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                        isCuratorMode
                          ? 'bg-[#1E3A5F] dark:bg-[#7FA6D6] border-transparent text-white dark:text-[#101216]'
                          : 'border-neutral-300 dark:border-neutral-700 text-[#14171F] dark:text-[#EAECEF] hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>{isCuratorMode ? 'Modo Curador ativo' : 'Ativar Modo Curador'}</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#14171F] dark:text-[#EAECEF]">
                      Entrar com Google
                    </p>
                    <p className="text-xs text-[#5A6474] dark:text-[#9AA4B2] mt-0.5 leading-snug">
                      Opcional para gerar novas narrações dramatizadas quando uma história ainda não tiver áudio pronto.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onSignInGoogle}
                    disabled={isSigningIn}
                    className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 rounded-xl bg-[#1E3A5F] dark:bg-[#7FA6D6] text-white dark:text-[#101216] text-xs font-semibold hover:bg-[#162C49] dark:hover:bg-[#93B6E0] inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-65"
                  >
                    {isSigningIn ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        <span>Entrando…</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Entrar com Google</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
