import type {
  ChoiceStyle,
  FontFamily,
  PageTransition,
  StoryTheme,
  ThemeColor,
  ThemePreset,
} from '@ie/story';

/*
 * Story themes (ADR 0018): a preset plus overrides, resolved into the design tokens' own CSS
 * variables and set on the element that holds the story. Pure functions, apart from apply.
 */

export type Palette = Readonly<Record<ThemeColor, string>>;

interface PresetLook {
  readonly palette?: Palette;
  readonly prose?: FontFamily;
  readonly ui?: FontFamily;
  readonly choices?: ChoiceStyle;
  readonly transition?: PageTransition;
}

/** Auto sets nothing, so the page follows the reader's Paper/Night. */
export const PRESETS: Readonly<Record<ThemePreset, PresetLook>> = {
  auto: {},
  paper: {
    palette: {
      bg: '#f4f1ea',
      surface: '#fbf9f4',
      ink: '#1c1b19',
      muted: '#5f5a52',
      accent: '#9a4a2e',
      line: '#1c1b19',
    },
  },
  night: {
    palette: {
      bg: '#0f0f10',
      surface: '#161618',
      ink: '#dcd8d0',
      muted: '#9c978e',
      accent: '#d48a5f',
      line: '#dcd8d0',
    },
  },
  terminal: {
    palette: {
      bg: '#0b0f0b',
      surface: '#111811',
      ink: '#9be89a',
      muted: '#62a060',
      accent: '#d7f7a8',
      line: '#9be89a',
    },
    prose: 'mono',
    ui: 'mono',
    choices: 'underline',
    transition: 'none',
  },
  noir: {
    palette: {
      bg: '#121212',
      surface: '#1b1b1b',
      ink: '#e8e4dc',
      muted: '#8f8a82',
      accent: '#d04848',
      line: '#e8e4dc',
    },
    choices: 'underline',
    transition: 'fade',
  },
  neon: {
    palette: {
      bg: '#0d0b1a',
      surface: '#17142d',
      ink: '#ece8ff',
      muted: '#a39bd0',
      accent: '#ff4fd8',
      line: '#ece8ff',
    },
    prose: 'sans',
    choices: 'filled',
    transition: 'rise',
  },
  parchment: {
    palette: {
      bg: '#efe3c8',
      surface: '#f6ecd6',
      ink: '#3b2a1a',
      muted: '#6e5a43',
      accent: '#8b2e1f',
      line: '#3b2a1a',
    },
    transition: 'fade',
  },
  static: {
    palette: {
      bg: '#e9e9e6',
      surface: '#f6f6f4',
      ink: '#111111',
      muted: '#5c5c5c',
      accent: '#1f5fd1',
      line: '#111111',
    },
    prose: 'sans',
    choices: 'filled',
    transition: 'none',
  },
};

export const THEME_FONTS: Readonly<Record<FontFamily, string>> = {
  serif: "'Literata', 'Iowan Old Style', Georgia, serif",
  sans: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace",
};

type Rgb = readonly [number, number, number];

function rgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

function mix(a: string, b: string, amount: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return toHex([r1 + (r2 - r1) * amount, g1 + (g2 - g1) * amount, b1 + (b2 - b1) * amount]);
}

function alpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgb(${r} ${g} ${b} / ${a})`;
}

/** WCAG relative luminance of a `#rrggbb` colour. */
export function luminance(hex: string): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two `#rrggbb` colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The six colours a theme ends up with, or null where Auto leaves the reader's own. */
export function themeColors(theme: StoryTheme | undefined): Partial<Palette> {
  const preset = PRESETS[theme?.preset ?? 'auto'].palette ?? {};
  return { ...preset, ...theme?.colors };
}

export interface ContrastWarning {
  readonly color: 'ink' | 'muted';
  readonly ratio: number;
  readonly needs: number;
}

/** Text that falls below WCAG contrast against the background: 4.5 for ink, 3 for muted. */
export function themeWarnings(theme: StoryTheme | undefined): ContrastWarning[] {
  const colors = themeColors(theme);
  if (!colors.bg) return [];
  const warnings: ContrastWarning[] = [];
  for (const [color, needs] of [
    ['ink', 4.5],
    ['muted', 3],
  ] as const) {
    const value = colors[color];
    if (!value) continue;
    const ratio = contrastRatio(value, colors.bg);
    if (ratio < needs) warnings.push({ color, ratio: Math.round(ratio * 10) / 10, needs });
  }
  return warnings;
}

export interface ResolvedTheme {
  /** CSS custom properties to set, by name. */
  readonly vars: Readonly<Record<string, string>>;
  readonly choices: ChoiceStyle;
  readonly transition: PageTransition;
}

/** Resolves a theme into token values. Derived tokens follow from the six colours. */
export function resolveStoryTheme(theme: StoryTheme | undefined): ResolvedTheme {
  const look = PRESETS[theme?.preset ?? 'auto'];
  const c = themeColors(theme);
  const vars: Record<string, string> = {};
  const dark = c.bg ? luminance(c.bg) < 0.2 : undefined;
  if (c.bg) {
    vars['--color-bg'] = c.bg;
    vars['color-scheme'] = dark ? 'dark' : 'light';
    vars['--color-scrim'] = dark ? 'rgb(0 0 0 / 0.5)' : alpha(c.ink ?? '#000000', 0.28);
  }
  if (c.surface) {
    vars['--color-surface'] = c.surface;
    vars['--color-surface-raised'] = mix(c.surface, '#ffffff', dark ? 0.04 : 0.6);
  }
  if (c.ink) vars['--color-ink'] = c.ink;
  if (c.muted) {
    vars['--color-ink-muted'] = c.muted;
    vars['--color-ink-faint'] = c.bg ? mix(c.muted, c.bg, 0.35) : c.muted;
  }
  if (c.accent) {
    vars['--color-accent'] = c.accent;
    vars['--color-focus'] = c.accent;
    vars['--color-selection'] = alpha(c.accent, 0.22);
    const light = c.bg && !dark ? c.bg : '#ffffff';
    const deep = c.bg && dark ? c.bg : '#111111';
    vars['--color-accent-ink'] =
      contrastRatio(c.accent, light) >= contrastRatio(c.accent, deep) ? light : deep;
  }
  if (c.line) {
    vars['--color-line'] = alpha(c.line, dark ? 0.14 : 0.12);
    vars['--color-line-strong'] = alpha(c.line, dark ? 0.26 : 0.24);
  }
  const prose = theme?.prose ?? look.prose;
  const ui = theme?.ui ?? look.ui;
  if (prose) vars['--font-prose'] = THEME_FONTS[prose];
  if (ui) vars['--font-ui'] = THEME_FONTS[ui];
  if (theme?.size !== undefined) vars['--theme-scale'] = String(theme.size);
  if (theme?.leading !== undefined) vars['--leading-prose'] = String(theme.leading);
  return {
    vars,
    choices: theme?.choices ?? look.choices ?? 'outline',
    transition: theme?.transition ?? look.transition ?? 'none',
  };
}

const APPLIED = new WeakMap<HTMLElement, readonly string[]>();

/** Sets a resolved theme on an element (and clears what an earlier theme set there). */
export function applyStoryTheme(element: HTMLElement, resolved: ResolvedTheme | null): void {
  for (const name of APPLIED.get(element) ?? []) element.style.removeProperty(name);
  const names = resolved ? Object.keys(resolved.vars) : [];
  for (const name of names) element.style.setProperty(name, resolved?.vars[name] ?? '');
  APPLIED.set(element, names);
  if (resolved) {
    element.dataset.choices = resolved.choices;
    element.dataset.transition = resolved.transition;
    element.dataset.storyTheme = 'true';
  } else {
    delete element.dataset.choices;
    delete element.dataset.transition;
    delete element.dataset.storyTheme;
  }
}
