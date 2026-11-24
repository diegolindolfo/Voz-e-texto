import { useState, type FormEvent } from 'react';
import { Loader2, X } from 'lucide-react';
import { CUSTOM_SAMPLE_EXCERPT } from '../data/books';
import { authFetch, safeParseJson } from '../lib/apiClient';
import type { Chapter, ChapterCharacter, ScriptTurn } from '../types';

interface ImportChapterSheetProps {
  open: boolean;
  onClose: () => void;
  bookId: string;
  nextChapterNumber: number;
  onChapterCreated: (chapter: Chapter) => void;
}

export function ImportChapterSheet({
  open,
  onClose,
  bookId,
  nextChapterNumber,
  onChapterCreated,
}: ImportChapterSheetProps) {
  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!open) return null;

  const handleLoadSample = () => {
    setTitle('O Sapo Verde e a Garça Branca');
    setRawText(CUSTOM_SAMPLE_EXCERPT);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanText = rawText.trim();

    if (!cleanTitle) {
      setErrorMessage('Informe um título para a fábula ou conto antes de pré-ajustar.');
      return;
    }
    if (cleanText.length < 30) {
      setErrorMessage('Cole pelo menos um parágrafo curto (mínimo de 30 caracteres).');
      return;
    }

    setErrorMessage(null);
    setIsAnalyzing(true);
    try {
      const response = await authFetch('/api/chapters/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: cleanTitle, rawText: cleanText }),
      });

      const payload = await safeParseJson<{
        summary: string;
        moral?: string;
        aiNotes?: string;
        characters: ChapterCharacter[];
        turns: ScriptTurn[];
        error?: string;
      }>(response, 'Não foi possível pré-ajustar o conto com a IA.');
      if (!response.ok || !Array.isArray(payload.characters) || !Array.isArray(payload.turns)) {
        throw new Error(payload.error || 'Não foi possível pré-ajustar o conto com a IA.');
      }

      const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
      const newChapter: Chapter = {
        id: `custom-${Date.now()}`,
        bookId,
        number: nextChapterNumber,
        roman: String(nextChapterNumber),
        numberLabel: `Conto ${nextChapterNumber}`,
        title: cleanTitle,
        estimatedMinutes: Math.max(1, Math.round(wordCount / 135)),
        wordCount,
        characterCount: payload.characters.length,
        hasDialogue: payload.characters.length > 1,
        dramatizedByAi: true,
        moral: payload.moral,
        aiNotes: payload.aiNotes,
        summary: payload.summary,
        characters: payload.characters,
        turns: payload.turns,
        isCustom: true,
      };

      onChapterCreated(newChapter);
      setTitle('');
      setRawText('');
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao separar personagens e falas da história.',
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Importar fábula ou conto em domínio público"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isAnalyzing) onClose();
      }}
    >
      <div className="w-full sm:max-w-lg max-h-[90vh] bg-[#F7F7F5] dark:bg-[#14171D] rounded-t-3xl sm:rounded-3xl border-t sm:border border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden">
        <div className="pt-3 pb-2.5 px-5 border-b border-neutral-200/80 dark:border-neutral-800">
          <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700 mx-auto mb-3 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-editorial text-lg font-semibold text-[#14171F] dark:text-[#EAECEF]">
                Pré-ajustar nova fábula ou conto com IA
              </h2>
              <p className="text-xs text-[#5A6474] dark:text-[#9AA4B2]">
                A IA separa o Contador de Histórias, os personagens, a direção vocal e a moral da história.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isAnalyzing}
              aria-label="Fechar importação"
              className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-full text-[#5A6474] dark:text-[#9AA4B2] hover:bg-neutral-200/60 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-40"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-5 space-y-4 pb-safe">
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label
                htmlFor="import-chapter-title"
                className="text-xs font-semibold text-[#5A6474] dark:text-[#9AA4B2]"
              >
                Título da fábula ou conto
              </label>
              <button
                type="button"
                onClick={handleLoadSample}
                className="text-xs font-medium text-[#1E3A5F] dark:text-[#7FA6D6] hover:underline underline-offset-4 cursor-pointer"
              >
                Preencher fábula de exemplo
              </button>
            </div>
            <input
              id="import-chapter-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: O Pastorzinho e o Lobo"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#1D222B] border border-neutral-300 dark:border-neutral-700 text-sm text-[#14171F] dark:text-[#EAECEF] placeholder:text-[#8A94A3] focus:outline-2 focus:outline-[#1E3A5F]"
            />
          </div>

          <div>
            <label
              htmlFor="import-chapter-text"
              className="block text-xs font-semibold text-[#5A6474] dark:text-[#9AA4B2] mb-1.5"
            >
              Texto da fábula ou conto
            </label>
            <textarea
              id="import-chapter-text"
              rows={7}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Cole aqui o texto em português de uma fábula ou conto infantil em domínio público…"
              className="w-full px-3.5 py-3 rounded-xl bg-white dark:bg-[#1D222B] border border-neutral-300 dark:border-neutral-700 font-serif-reading text-[15px] leading-relaxed text-[#14171F] dark:text-[#EAECEF] placeholder:font-sans placeholder:text-sm placeholder:text-[#8A94A3] focus:outline-2 focus:outline-[#1E3A5F]"
            />
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl px-3.5 py-2.5"
            >
              {errorMessage}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isAnalyzing}
              className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium text-[#5A6474] dark:text-[#9AA4B2] hover:bg-neutral-200/60 dark:hover:bg-neutral-800 cursor-pointer disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isAnalyzing}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#1E3A5F] dark:bg-[#7FA6D6] text-white dark:text-[#101216] text-sm font-semibold hover:bg-[#162C49] dark:hover:bg-[#93B6E0] inline-flex items-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-70"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Pré-ajustando com IA…</span>
                </>
              ) : (
                <span>Pré-ajustar vozes e moral</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
