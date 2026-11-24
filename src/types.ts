export type PrebuiltVoiceName = 'Charon' | 'Kore' | 'Puck' | 'Fenrir' | 'Zephyr';

export interface VoiceOption {
  name: PrebuiltVoiceName;
  label: string;
  timbre: string;
  tone: string;
}

export interface ScriptTurn {
  id: string;
  speaker: string;
  role: 'narrator' | 'character';
  style: string;
  text: string;
  pauseAfterMs?: number;
}

export interface ChapterCharacter {
  name: string;
  role: 'narrator' | 'character';
  description: string;
  defaultVoice: PrebuiltVoiceName;
  defaultStyle: string;
}

export interface ChapterSummary {
  id: string;
  bookId: string;
  number: number;
  roman: string;
  numberLabel: string;
  title: string;
  estimatedMinutes: number;
  wordCount: number;
  characterCount: number;
  hasDialogue: boolean;
  dramatizedByAi?: boolean;
  moral?: string;
  aiNotes?: string;
  illustrationUrl?: string;
  isCustom?: boolean;
}

export interface Chapter extends ChapterSummary {
  summary: string;
  characters: ChapterCharacter[];
  turns: ScriptTurn[];
}

export interface BookCatalogItem {
  id: string;
  title: string;
  author: string;
  year: number;
  publicDomainSource: string;
  coverUrl: string;
  synopsis: string;
  gutenbergId?: number;
  isCustom?: boolean;
  chapters: ChapterSummary[];
}

export interface Book {
  id: string;
  title: string;
  author: string;
  year: number;
  publicDomainSource: string;
  coverUrl: string;
  synopsis: string;
  gutenbergId?: number;
  isCustom?: boolean;
  chapters: Chapter[];
}

export interface PublicDomainCatalogEntry {
  gutenbergId?: number;
  slug: string;
  title: string;
  author: string;
  year: number;
  synopsis: string;
  narratorName?: string;
  installed?: boolean;
  prebuiltChapters?: Chapter[];
}

export type ReadingMode = 'dramatized' | 'narrator';
export type AudioMimeType = 'audio/mpeg' | 'audio/wav';

export interface AudioSegmentTiming {
  turnId: string;
  speaker: string;
  voiceName: PrebuiltVoiceName;
  startSec: number;
  endSec: number;
}

export interface CachedAudioMetadata {
  cacheKey: string;
  chapterId: string;
  bookId?: string;
  bookTitle: string;
  chapterTitle: string;
  mode: ReadingMode;
  voiceMap: Record<string, PrebuiltVoiceName>;
  durationSec: number;
  fileSizeBytes: number;
  mimeType?: AudioMimeType;
  createdAt: string;
  segments: AudioSegmentTiming[];
  audioUrl: string;
  storageSource?: 'firebase-storage' | 'firestore' | 'static' | 'local-server';
  storagePath?: string;
  downloadUrl?: string;
  chunkCount?: number;
  createdByUid?: string;
  createdByName?: string;
}

export interface SynthesizeResponse extends CachedAudioMetadata {
  cached: boolean;
}

export interface CacheSummaryItem extends CachedAudioMetadata {
  exists: boolean;
}

export interface CacheInventoryResponse {
  items: CacheSummaryItem[];
  totalSizeBytes: number;
  count: number;
}

export interface TtsJobProgress {
  chapterId: string;
  chapterTitle: string;
  cacheKey: string;
  source: 'foreground' | 'queue';
  state: 'synthesizing' | 'waiting_retry';
  completedBatches: number;
  totalBatches: number;
  reusedBatches: number;
  waitingRetrySec?: number;
}

export interface TtsQueueItem {
  id: string;
  bookId: string;
  chapterId: string;
  chapterTitle: string;
  mode: ReadingMode;
  status: 'queued' | 'running' | 'done' | 'failed';
  error?: string;
}

export interface TtsStatusResponse {
  activeJob: TtsJobProgress | null;
  queue: TtsQueueItem[];
  pacingSec: number;
  dailyQuotaPaused: boolean;
  dailyQuotaMessage?: string;
}
