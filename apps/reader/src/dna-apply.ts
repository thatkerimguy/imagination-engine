// Applies Book Visual DNA to a reading root: resolved `--dna-*` colour / font / shape / motion
// tokens, the atmosphere layer, the baked surface tiles (`--dna-tile-<material>`) and the Soft
// Page Harmony page tokens on :root, all re-resolved live when the reader switches light ↔ dark
// (mounted cards swap tiles without remounting). Its own small lazy chunk, loaded as soon as a
// chapter opens (prose-only chapters included), independent of the engine host.
import {
  SURFACE_MATERIALS,
  DNA_ARCHETYPES,
  isDnaArchetypeId,
  parseVisualDna,
  resolveVisualDna,
  type BookVisualDna,
  type DnaArchetypeId,
  type DnaTheme,
  type ResolvedVisualDna,
} from '@kn/core/dna';
import { surfaceTile } from '@kn/engines/shared';

/** Root-level tokens Soft Page Harmony reads (only while Aa is on "Book"). */
export const PAGE_TOKENS = ['--dna-page-bg', '--dna-page-font'] as const;

/** Books without DNA (and new writer books) read as Editorial Minimal. */
export const DEFAULT_DNA: DnaArchetypeId = 'editorial-minimal';

/** Accepts an archetype id shorthand (`"noir-rain"`) or a full 7-axis object; else the default. */
export function bookDna(raw: unknown, fallback: DnaArchetypeId = DEFAULT_DNA): BookVisualDna {
  if (isDnaArchetypeId(raw)) return DNA_ARCHETYPES[raw];
  if (raw !== undefined) {
    const parsed = parseVisualDna(raw);
    if (parsed.ok) return parsed.dna;
    console.warn('[dna] invalid visualDna, using default', parsed.errors.slice(0, 3));
  }
  return DNA_ARCHETYPES[fallback];
}

/** The reader's `warm` paper theme is light; `dark` and `obsidian` are dark. */
export const dnaThemeOf = (root: HTMLElement = document.documentElement): DnaTheme =>
  root.dataset.theme === 'warm' ? 'light' : 'dark';

function atmosphere(r: ResolvedVisualDna): string {
  const k = r.atmosphere.intensity;
  const pct = (n: number): string => `${Math.round(n * k * 100)}%`;
  const shade = r.theme === 'dark' ? '#000' : 'var(--dna-ink)';
  switch (r.atmosphere.style) {
    case 'none':
      return 'none';
    case 'subtle-vignette':
      return `radial-gradient(ellipse at center,transparent 55%,color-mix(in srgb,${shade} ${pct(0.45)},transparent))`;
    case 'scanline-mist':
      return `linear-gradient(180deg,color-mix(in srgb,var(--dna-accent) ${pct(0.22)},transparent),transparent 45%)`;
    case 'warm-glow':
      return `radial-gradient(circle at 18% 0%,color-mix(in srgb,var(--dna-warn) ${pct(0.3)},transparent),transparent 62%)`;
    case 'ink-edge':
      return `radial-gradient(ellipse at center,transparent 60%,color-mix(in srgb,var(--dna-ink) ${pct(0.22)},transparent))`;
  }
}

const memo = new Map<string, ResolvedVisualDna>();

export function resolveCached(dna: BookVisualDna, theme: DnaTheme): ResolvedVisualDna {
  const key = `${theme}:${JSON.stringify(dna)}`;
  let r = memo.get(key);
  if (!r) {
    r = resolveVisualDna(dna, theme);
    memo.set(key, r);
  }
  return r;
}

/** Writes every token onto `el` (style properties) and returns the resolved DNA. */
export function applyDnaTokens(
  el: HTMLElement,
  dna: BookVisualDna,
  theme: DnaTheme,
): ResolvedVisualDna {
  const r = resolveCached(dna, theme);
  for (const [k, v] of Object.entries(r.tokens)) el.style.setProperty(k, v);
  el.style.setProperty('--kn-e-atmos', atmosphere(r));
  // Tiles are cached per (material, theme, grain step): a theme flip re-points every var.
  const grain = r.surface.grainIntensity;
  for (const m of SURFACE_MATERIALS) {
    if (m !== 'clean') el.style.setProperty(`--dna-tile-${m}`, surfaceTile(m, theme, grain));
  }
  el.dataset.dnaTheme = theme;
  el.dataset.dnaOrnament = r.ornament.grammar;
  return r;
}

const watched = new WeakMap<HTMLElement, { dna: BookVisualDna; stop: () => void }>();

/**
 * Applies DNA to a reading root once and keeps it in step with the reader theme (Settings →
 * Theme), with no document reload. Returns the DNA resolved for the current theme.
 */
export function attachDna(root: HTMLElement, dna: BookVisualDna): ResolvedVisualDna {
  const prev = watched.get(root);
  // The router clears the reading root's inline style between chapters: re-apply then.
  const intact = root.style.getPropertyValue('--dna-bg') !== '';
  if (prev && intact && JSON.stringify(prev.dna) === JSON.stringify(dna)) {
    return resolveCached(dna, dnaThemeOf());
  }
  prev?.stop();
  const apply = (): ResolvedVisualDna => {
    const r = applyDnaTokens(root, dna, dnaThemeOf());
    const page = document.documentElement.style;
    for (const k of PAGE_TOKENS) page.setProperty(k, r.tokens[k] ?? '');
    return r;
  };
  const resolved = apply();
  const obs = new MutationObserver(() => {
    if (!root.isConnected) return stop();
    if (root.dataset.dnaTheme !== dnaThemeOf()) apply();
  });
  const stop = (): void => {
    obs.disconnect();
    watched.delete(root);
  };
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  watched.set(root, { dna, stop });
  return resolved;
}

/** Drops the page tokens (shelf / TOC views read as the plain reader theme). */
export function clearPageDna(): void {
  for (const k of PAGE_TOKENS) document.documentElement.style.removeProperty(k);
}
