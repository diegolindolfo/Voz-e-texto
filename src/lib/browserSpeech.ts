import type { ReadingMode, ScriptTurn } from '../types';

export interface BrowserSpeechCallbacks {
  onTurnChange: (turnIndex: number) => void;
  onStateChange: (isPlaying: boolean) => void;
  onEnd: () => void;
  onError?: (message: string) => void;
}

export function isBrowserSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

/**
 * Lightweight Brazilian Portuguese Web Speech API reader used as an instant,
 * zero-quota fallback when Gemini API daily limits are reached or offline.
 */
export class BrowserSpeechReader {
  private turns: ScriptTurn[] = [];
  private mode: ReadingMode = 'dramatized';
  private currentIndex = 0;
  private rate = 1;
  private active = false;
  private paused = false;
  private callbacks: BrowserSpeechCallbacks;
  private sessionId = 0;

  constructor(callbacks: BrowserSpeechCallbacks) {
    this.callbacks = callbacks;
  }

  private pickVoice(speakerIndex: number): SpeechSynthesisVoice | null {
    if (!isBrowserSpeechSupported()) return null;
    const voices = window.speechSynthesis.getVoices();
    const ptBr = voices.filter((v) => v.lang.toLowerCase().startsWith('pt-br'));
    const ptAny = voices.filter((v) => v.lang.toLowerCase().startsWith('pt'));
    const pool = ptBr.length > 0 ? ptBr : ptAny;
    if (pool.length === 0) return null;
    return pool[speakerIndex % pool.length];
  }

  start(turns: ScriptTurn[], mode: ReadingMode, rate: number, startIndex = 0): void {
    if (!isBrowserSpeechSupported()) {
      this.callbacks.onError?.('Este navegador não suporta leitura por voz local.');
      return;
    }
    if (turns.length === 0) return;

    this.stop();
    this.turns = turns;
    this.mode = mode;
    this.rate = rate;
    this.currentIndex = Math.max(0, Math.min(startIndex, turns.length - 1));
    this.active = true;
    this.paused = false;
    this.sessionId += 1;
    this.speakCurrentTurn(this.sessionId);
  }

  private speakCurrentTurn(session: number): void {
    if (!this.active || session !== this.sessionId) return;
    if (this.currentIndex >= this.turns.length) {
      this.active = false;
      this.paused = false;
      this.callbacks.onStateChange(false);
      this.callbacks.onEnd();
      return;
    }

    const turn = this.turns[this.currentIndex];
    const utterance = new SpeechSynthesisUtterance(turn.text);
    utterance.lang = 'pt-BR';
    utterance.rate = this.rate;

    // Give subtle vocal distinction across characters in dramatized mode
    const speakerOrder = this.getSpeakerOrder(turn.speaker);
    const voice = this.pickVoice(this.mode === 'dramatized' ? speakerOrder : 0);
    if (voice) {
      utterance.voice = voice;
    }
    if (this.mode === 'dramatized' && turn.role === 'character') {
      const pitches = [1.0, 1.12, 0.9, 1.18, 0.94];
      utterance.pitch = pitches[speakerOrder % pitches.length];
    } else {
      utterance.pitch = 0.96;
    }

    utterance.onstart = () => {
      if (session !== this.sessionId) return;
      this.callbacks.onTurnChange(this.currentIndex);
      this.callbacks.onStateChange(true);
    };

    utterance.onend = () => {
      if (session !== this.sessionId || !this.active) return;
      this.currentIndex += 1;
      this.speakCurrentTurn(session);
    };

    utterance.onerror = (event) => {
      if (session !== this.sessionId) return;
      if (event.error === 'interrupted' || event.error === 'canceled') return;
      this.active = false;
      this.paused = false;
      this.callbacks.onStateChange(false);
      this.callbacks.onError?.('Não foi possível reproduzir com a voz local do navegador.');
    };

    this.callbacks.onTurnChange(this.currentIndex);
    this.callbacks.onStateChange(true);
    window.speechSynthesis.speak(utterance);
  }

  private getSpeakerOrder(speaker: string): number {
    const seen: string[] = [];
    for (const t of this.turns) {
      if (!seen.includes(t.speaker)) seen.push(t.speaker);
    }
    const idx = seen.indexOf(speaker);
    return idx >= 0 ? idx : 0;
  }

  togglePause(): void {
    if (!isBrowserSpeechSupported() || !this.active) return;
    if (this.paused) {
      this.paused = false;
      window.speechSynthesis.resume();
      this.callbacks.onStateChange(true);
    } else {
      this.paused = true;
      window.speechSynthesis.pause();
      this.callbacks.onStateChange(false);
    }
  }

  setRate(newRate: number): void {
    this.rate = newRate;
    if (this.active && !this.paused) {
      const idx = this.currentIndex;
      const turns = this.turns;
      const mode = this.mode;
      this.start(turns, mode, newRate, idx);
    }
  }

  seekToTurn(turnIndex: number): void {
    if (!this.active || this.turns.length === 0) return;
    this.start(this.turns, this.mode, this.rate, turnIndex);
  }

  skipTurn(delta: number): void {
    if (!this.active || this.turns.length === 0) return;
    const next = Math.max(0, Math.min(this.turns.length - 1, this.currentIndex + delta));
    this.start(this.turns, this.mode, this.rate, next);
  }

  stop(): void {
    this.sessionId += 1;
    this.active = false;
    this.paused = false;
    if (isBrowserSpeechSupported()) {
      window.speechSynthesis.cancel();
    }
    this.callbacks.onStateChange(false);
  }
}
