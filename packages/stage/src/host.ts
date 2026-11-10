import type { Label, MaterialDef } from '@ie/story';
import { parseCssColor } from './color.ts';
import { StageDirector } from './director.ts';
import type { FxState } from './fx.ts';
import type { StagePalette } from './stage.ts';

export interface StageHostOptions {
  /** The element the camera moves (the reader's text), and the stage's parent. */
  readonly root: () => HTMLElement | null;
  readonly locale: () => 'en' | 'tr';
  readonly beatPhase?: () => number | null;
  readonly beat?: () => { beat: number; beatsPerBar: number } | null;
  /** The project's materials (ADR 0020). */
  readonly materials?: () => readonly MaterialDef[] | undefined;
  /** Where the canvas goes; the window by default. */
  readonly mount?: () => HTMLElement | null;
  /** Fill the mount (a positioned panel) instead of the window. */
  readonly contained?: boolean;
}

/** Theme tokens as the stage's palette, so particles and titles follow Paper and Night. */
export function themePalette(): StagePalette {
  const css = getComputedStyle(document.documentElement);
  return {
    ink: parseCssColor(css.getPropertyValue('--color-ink'), [0.1, 0.1, 0.1]),
    accent: parseCssColor(css.getPropertyValue('--color-accent'), [0.6, 0.3, 0.2]),
    background: parseCssColor(css.getPropertyValue('--color-bg'), [0.95, 0.94, 0.92]),
  };
}

const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The stage as both apps use it: a director whose canvas sits over the page, a live region that
 * reads titles aloud, and camera shake applied to the DOM text as a compositor transform.
 */
export function createStageHost(options: StageHostOptions): StageDirector {
  let live: HTMLElement | null = null;
  const announce = (text: string) => {
    if (!live) {
      live = document.createElement('div');
      live.className = 'ie-sr-only';
      live.setAttribute('aria-live', 'polite');
      document.body.append(live);
    }
    live.textContent = text;
  };
  const moveText = (fx: FxState) => {
    const root = options.root();
    if (!root) return;
    const still = fx.offsetX === 0 && fx.offsetY === 0 && fx.angle === 0 && fx.zoom < 0.0005;
    root.style.transform = still
      ? ''
      : `translate(${fx.offsetX.toFixed(1)}px, ${fx.offsetY.toFixed(1)}px) rotate(${fx.angle.toFixed(4)}rad) scale(${(1 + fx.zoom).toFixed(4)})`;
  };
  const text = (label: Label) => {
    const locale = options.locale();
    return label[locale] || label.en || label.tr || '';
  };
  const family = getComputedStyle(document.documentElement).getPropertyValue('--font-prose') || 'serif';
  // Glyphs are drawn from the loaded font, so start loading it before the first title needs it.
  void document.fonts?.load(`48px ${family}`).catch(() => undefined);
  const director = new StageDirector({
    mount: options.mount ?? (() => document.body),
    ...(options.contained ? { canvasClass: 'ie-stage ie-stage--contained' } : {}),
    family,
    palette: themePalette,
    reducedMotion,
    text,
    announce,
    onFx: moveText,
    ...(options.beatPhase ? { beatPhase: options.beatPhase } : {}),
    ...(options.beat ? { beat: options.beat } : {}),
    ...(options.materials ? { materials: options.materials } : {}),
  });
  if (typeof matchMedia === 'function')
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) =>
      director.setReducedMotion(e.matches),
    );
  return director;
}
