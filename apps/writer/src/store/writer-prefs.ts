// Writer-only UI preferences (device level, never part of a novel): theme, typography, editor
// chrome and the custom-font registry. Stored under writer-only KV keys.
import { isThemeId, type ThemeId } from '../ui/themes.ts';
import type { NovelRepository } from './repository.ts';
import { keys } from './documents.ts';

export const WRITER_UI_KEY = 'prefs/writer-ui';
export const CUSTOM_FONTS_KEY = 'prefs/custom-fonts';

export type ThemeChoice = ThemeId | 'system';
export type MarginPreset = 'compact' | 'comfortable' | 'wide';
export type TextAlign = 'left' | 'center' | 'right';
/** How 'Match phone theme' uses the Android 12+ wallpaper palette. */
export type MaterialYouStyle = 'soft' | 'exact';

/** The 27 real-time metrics (order = default picker order). */
export const METRIC_IDS = [
  'chars',
  'charsNoSpaces',
  'words',
  'sentences',
  'paragraphs',
  'typingCpm',
  'typingWpm',
  'uniqueWords',
  'uniquePct',
  'mattr',
  'lexicalDensity',
  'grammarWords',
  'contentWords',
  'syllables',
  'complexWords',
  'avgWordLength',
  'avgSentenceLength',
  'avgParagraphLength',
  'readingTime',
  'speakingTime',
  'fleschEase',
  'fleschKincaid',
  'gunningFog',
  'smog',
  'colemanLiau',
  'ari',
  'dialogueShare',
] as const;
export type MetricId = (typeof METRIC_IDS)[number];

/** Every formatting-toolbar button (order = default order). */
export const TOOL_IDS = [
  'tab',
  'bold',
  'italic',
  'underline',
  'strike',
  'highlight',
  'h1',
  'h2',
  'h3',
  'align',
  'quote',
  'bullet',
  'fgColor',
  'bgColor',
  'comment',
  'separator',
  'addProse',
  'addDialogue',
  'addScene',
  'addGimmick',
] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export interface WriterPrefs {
  themeId: ThemeChoice;
  /** A catalog font id or `custom-font-<ulid>`. */
  fontId: string;
  fontSize: number;
  lineHeight: number;
  marginPreset: MarginPreset;
  firstLineIndent: boolean;
  defaultAlign: TextAlign;
  /** Samsung Keyboard friendly mode: autoCorrect and spellCheck off. */
  samsungSafeIme: boolean;
  showMetricsRibbon: boolean;
  visibleMetrics: MetricId[];
  toolbarOrder: ToolId[];
  hiddenTools: ToolId[];
  /** Formatting (left) half of the editor toolbar minimised to one expand arrow. */
  toolbarFormatCollapsed: boolean;
  /** Add-block (right) half of the editor toolbar minimised to one expand arrow. */
  toolbarAddCollapsed: boolean;
  /** Tactile feedback on taps and toggles (native only). */
  hapticsEnabled: boolean;
  /** 'soft' blends wallpaper surfaces toward Folio neutrals; 'exact' uses them as Android gives. */
  materialYouStyle: MaterialYouStyle;
}

export interface CustomFont {
  /** Immutable key, `custom-font-<ulid>`; also the expo-font family name. */
  id: string;
  displayName: string;
  uri: string;
  format: 'ttf' | 'otf';
  addedAt: number;
}

export const FONT_SIZE_RANGE = { min: 14, max: 28 } as const;
export const LINE_HEIGHT_RANGE = { min: 1.3, max: 2.2 } as const;

export const DEFAULT_WRITER_PREFS: WriterPrefs = {
  themeId: 'system',
  fontId: 'classic-serif',
  fontSize: 17,
  lineHeight: 1.55,
  marginPreset: 'comfortable',
  firstLineIndent: false,
  defaultAlign: 'left',
  samsungSafeIme: false,
  showMetricsRibbon: true,
  visibleMetrics: ['chars', 'words', 'sentences', 'paragraphs', 'typingCpm', 'lexicalDensity'],
  toolbarOrder: [...TOOL_IDS],
  hiddenTools: [],
  toolbarFormatCollapsed: false,
  toolbarAddCollapsed: false,
  hapticsEnabled: true,
  materialYouStyle: 'soft',
};

const clamp = (v: unknown, lo: number, hi: number, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
const oneOf = <T extends string>(v: unknown, all: readonly T[], d: T): T =>
  all.includes(v as T) ? (v as T) : d;
const listOf = <T extends string>(v: unknown, all: readonly T[], d: T[]): T[] =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is T => all.includes(x as T)))] : d;
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);

/** Maps the Phase 2 `appearance` setting onto a theme choice. */
export function migrateAppearance(appearance: unknown): ThemeChoice {
  if (appearance === 'light') return 'editorial-teal-light';
  if (appearance === 'dark') return 'editorial-teal-dark';
  return 'system';
}

/** Coerces anything (old versions, hand edits) into valid prefs. */
export function normalizeWriterPrefs(
  raw: Partial<Record<keyof WriterPrefs, unknown>>,
): WriterPrefs {
  const d = DEFAULT_WRITER_PREFS;
  const order = listOf(raw.toolbarOrder, TOOL_IDS, d.toolbarOrder);
  return {
    themeId: raw.themeId === 'system' || isThemeId(raw.themeId) ? raw.themeId : d.themeId,
    fontId: typeof raw.fontId === 'string' && raw.fontId ? raw.fontId : d.fontId,
    fontSize: clamp(raw.fontSize, FONT_SIZE_RANGE.min, FONT_SIZE_RANGE.max, d.fontSize),
    lineHeight: clamp(raw.lineHeight, LINE_HEIGHT_RANGE.min, LINE_HEIGHT_RANGE.max, d.lineHeight),
    marginPreset: oneOf(raw.marginPreset, ['compact', 'comfortable', 'wide'], d.marginPreset),
    firstLineIndent: bool(raw.firstLineIndent, d.firstLineIndent),
    defaultAlign: oneOf(raw.defaultAlign, ['left', 'center', 'right'], d.defaultAlign),
    samsungSafeIme: bool(raw.samsungSafeIme, d.samsungSafeIme),
    showMetricsRibbon: bool(raw.showMetricsRibbon, d.showMetricsRibbon),
    visibleMetrics: listOf(raw.visibleMetrics, METRIC_IDS, d.visibleMetrics),
    // New tools added in later versions are appended so they never silently disappear.
    toolbarOrder: [...order, ...TOOL_IDS.filter((t) => !order.includes(t))],
    hiddenTools: listOf(raw.hiddenTools, TOOL_IDS, d.hiddenTools),
    toolbarFormatCollapsed: bool(raw.toolbarFormatCollapsed, d.toolbarFormatCollapsed),
    toolbarAddCollapsed: bool(raw.toolbarAddCollapsed, d.toolbarAddCollapsed),
    hapticsEnabled: bool(raw.hapticsEnabled, d.hapticsEnabled),
    materialYouStyle: oneOf(raw.materialYouStyle, ['soft', 'exact'], d.materialYouStyle),
  };
}

export async function loadWriterPrefs(repo: NovelRepository): Promise<WriterPrefs> {
  const stored = await repo.docs.read<Partial<WriterPrefs>>(WRITER_UI_KEY);
  if (stored) return normalizeWriterPrefs(stored.data);
  const legacy = await repo.docs.read<{ appearance?: unknown }>(keys.setting('app'));
  return { ...DEFAULT_WRITER_PREFS, themeId: migrateAppearance(legacy?.data.appearance) };
}

export async function saveWriterPrefs(
  repo: NovelRepository,
  patch: Partial<WriterPrefs>,
): Promise<WriterPrefs> {
  const next = normalizeWriterPrefs({ ...(await loadWriterPrefs(repo)), ...patch });
  await repo.docs.write(WRITER_UI_KEY, next);
  return next;
}

// ── Custom font registry ────────────────────────────────────────────────────────────────────

const isCustomFont = (v: unknown): v is CustomFont => {
  const f = v as Partial<CustomFont> | null;
  return (
    !!f &&
    typeof f.id === 'string' &&
    f.id.startsWith('custom-font-') &&
    typeof f.displayName === 'string' &&
    typeof f.uri === 'string' &&
    (f.format === 'ttf' || f.format === 'otf') &&
    typeof f.addedAt === 'number'
  );
};

export async function loadCustomFonts(repo: NovelRepository): Promise<CustomFont[]> {
  const stored = await repo.docs.read<unknown>(CUSTOM_FONTS_KEY);
  return Array.isArray(stored?.data) ? stored.data.filter(isCustomFont) : [];
}

export async function saveCustomFonts(
  repo: NovelRepository,
  fonts: readonly CustomFont[],
): Promise<void> {
  await repo.docs.write(CUSTOM_FONTS_KEY, fonts.filter(isCustomFont));
}
