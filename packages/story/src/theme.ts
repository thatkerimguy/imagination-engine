import { z } from 'zod';

/*
 * A story's look (ADR 0018): a preset plus optional overrides. Pure data; @ie/present turns it
 * into the design tokens' CSS variables.
 */

export const THEME_PRESETS = [
  'auto',
  'paper',
  'night',
  'terminal',
  'noir',
  'neon',
  'parchment',
  'static',
] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

export const THEME_COLORS = ['bg', 'surface', 'ink', 'muted', 'accent', 'line'] as const;
export type ThemeColor = (typeof THEME_COLORS)[number];

/** The bundled families: Literata, Inter, JetBrains Mono. All of them cover Turkish. */
export const FONT_FAMILIES = ['serif', 'sans', 'mono'] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

export const CHOICE_STYLES = ['outline', 'filled', 'underline', 'plain'] as const;
export type ChoiceStyle = (typeof CHOICE_STYLES)[number];

export const PAGE_TRANSITIONS = ['none', 'fade', 'rise'] as const;
export type PageTransition = (typeof PAGE_TRANSITIONS)[number];

export const THEME_SIZE = { min: 0.85, max: 1.3 } as const;
export const THEME_LEADING = { min: 1.3, max: 2 } as const;

export interface StoryTheme {
  readonly preset: ThemePreset;
  readonly colors?: Partial<Readonly<Record<ThemeColor, string>>>;
  readonly prose?: FontFamily;
  readonly ui?: FontFamily;
  /** Multiplies the reader's own text size. */
  readonly size?: number;
  readonly leading?: number;
  readonly choices?: ChoiceStyle;
  readonly transition?: PageTransition;
}

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colours look like #1c1b19');

export const themeSchema = z.object({
  preset: z.enum(THEME_PRESETS),
  colors: z.partialRecord(z.enum(THEME_COLORS), hex).optional(),
  prose: z.enum(FONT_FAMILIES).optional(),
  ui: z.enum(FONT_FAMILIES).optional(),
  size: z.number().min(THEME_SIZE.min).max(THEME_SIZE.max).optional(),
  leading: z.number().min(THEME_LEADING.min).max(THEME_LEADING.max).optional(),
  choices: z.enum(CHOICE_STYLES).optional(),
  transition: z.enum(PAGE_TRANSITIONS).optional(),
});
