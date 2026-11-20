// Shared contract for the 27 real-time text metrics: the result shape produced by
// realtime.ts `analyzeDocument()` and the labels / formatters used by the ribbon and sheets.
import type { MetricId } from '../store/writer-prefs.ts';

export type { MetricId } from '../store/writer-prefs.ts';
export { METRIC_IDS } from '../store/writer-prefs.ts';

export type DocumentMetrics = Readonly<Record<MetricId, number>> & {
  /** SMOG is only reliable from 30 sentences; below that it is flagged as an estimate. */
  readonly smogIsEstimate: boolean;
};

export interface TypingSpeed {
  cpm: number;
  wpm: number;
}

export interface AnalyzeOptions {
  /** Also count `gits-cyberbrain-chat` message lines (module prop `messages`). Default false. */
  includeChat?: boolean;
  /** Live typing speed from a TypingMeter; 0 when omitted. */
  typing?: TypingSpeed;
}

/** Rolling 60 s typing-speed window that pauses after 5 s idle (implemented in realtime.ts). */
export interface TypingMeter {
  /** Reports the document's current character count at time `now` (ms). */
  record(totalChars: number, now: number): void;
  speed(now: number): TypingSpeed;
  reset(): void;
}

export type MetricGroup = 'counts' | 'vocabulary' | 'readability' | 'time' | 'speed';

export interface MetricInfo {
  id: MetricId;
  label: string;
  /** Compact label for the 38dp ribbon. */
  short: string;
  group: MetricGroup;
  format(value: number): string;
}

const int = (v: number): string => Math.round(v).toLocaleString('en-US');
const dec = (v: number): string => (Number.isFinite(v) ? v.toFixed(1) : '–');
const pct = (v: number): string => `${dec(v)}%`;
const minutes = (v: number): string => {
  const s = Math.round(v * 60);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};

const m = (
  id: MetricId,
  label: string,
  short: string,
  group: MetricGroup,
  format: (v: number) => string,
): MetricInfo => ({ id, label, short, group, format });

/** Reading / speaking time values are minutes. Percentages are 0–100. */
export const METRICS: Readonly<Record<MetricId, MetricInfo>> = {
  chars: m('chars', 'Characters', 'Chars', 'counts', int),
  charsNoSpaces: m('charsNoSpaces', 'Characters (no spaces)', 'Chars ⎵', 'counts', int),
  words: m('words', 'Words', 'Words', 'counts', int),
  sentences: m('sentences', 'Sentences', 'Sent.', 'counts', int),
  paragraphs: m('paragraphs', 'Paragraphs', 'Para.', 'counts', int),
  typingCpm: m('typingCpm', 'Typing speed', 'c/min', 'speed', int),
  typingWpm: m('typingWpm', 'Typing speed (WPM)', 'WPM', 'speed', int),
  uniqueWords: m('uniqueWords', 'Unique words', 'Unique', 'vocabulary', int),
  uniquePct: m('uniquePct', 'Unique word %', 'Unique %', 'vocabulary', pct),
  mattr: m('mattr', 'Lexical diversity (MATTR-50)', 'MATTR', 'vocabulary', pct),
  lexicalDensity: m('lexicalDensity', 'Lexical density', 'Density', 'vocabulary', pct),
  grammarWords: m('grammarWords', 'Grammar words', 'Grammar', 'vocabulary', int),
  contentWords: m('contentWords', 'Non-grammar words', 'Content', 'vocabulary', int),
  syllables: m('syllables', 'Syllables', 'Syll.', 'counts', int),
  complexWords: m('complexWords', 'Complex words (3+ syllables)', 'Complex', 'vocabulary', int),
  avgWordLength: m('avgWordLength', 'Avg word length', 'Avg word', 'counts', dec),
  avgSentenceLength: m('avgSentenceLength', 'Avg sentence length', 'Avg sent.', 'counts', dec),
  avgParagraphLength: m('avgParagraphLength', 'Avg paragraph length', 'Avg para.', 'counts', dec),
  readingTime: m('readingTime', 'Reading time (225 WPM)', 'Read', 'time', minutes),
  speakingTime: m('speakingTime', 'Speaking time (140 WPM)', 'Speak', 'time', minutes),
  fleschEase: m('fleschEase', 'Flesch reading ease', 'Flesch', 'readability', dec),
  fleschKincaid: m('fleschKincaid', 'Flesch–Kincaid grade', 'FK grade', 'readability', dec),
  gunningFog: m('gunningFog', 'Gunning fog', 'Fog', 'readability', dec),
  smog: m('smog', 'SMOG', 'SMOG', 'readability', dec),
  colemanLiau: m('colemanLiau', 'Coleman–Liau', 'C–L', 'readability', dec),
  ari: m('ari', 'Automated readability (ARI)', 'ARI', 'readability', dec),
  dialogueShare: m('dialogueShare', 'Dialogue share', 'Dialogue', 'counts', pct),
};
