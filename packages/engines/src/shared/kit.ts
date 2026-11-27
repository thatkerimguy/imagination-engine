// Engine kit: the shared frame every engine mounts into (scoped root, DNA surface tile, ornament
// layer, accent role, border, live tier attribute) plus small lifecycle helpers. Keeps each
// engine focused on its own craft and its lazy chunk small.
import type {
  BlueprintProps,
  EngineRuntimeContext,
  EngineTier,
  GimmickBlueprint,
} from '@kn/core/gimmicks';
import { accentVar, cls, el, injectEngineStyle } from './dom-safe.ts';

const BASE_CSS = `
.kn-e{position:relative;box-sizing:border-box;width:100%;max-width:100%;margin:1.4em 0;padding:16px 18px;
color:var(--dna-ink,#e6e6e6);background-color:var(--dna-surface,#1f2125);
background-image:var(--kn-e-atmos,none),var(--kn-e-tile,none);
background-size:100% 100%,128px 128px;background-repeat:no-repeat,repeat;border-radius:var(--dna-radius,10px);font-family:var(--dna-font-diegetic,ui-monospace,monospace);
letter-spacing:var(--dna-tracking,0);line-height:1.5;overflow-wrap:anywhere;isolation:isolate;text-align:left}
.kn-e *{box-sizing:border-box}
.kn-e>.kn-e-orn{z-index:0}
.kn-e>.kn-e-body{position:relative;z-index:1;min-width:0}
.kn-e[data-border=hairline]{border:var(--dna-stroke,1px) solid color-mix(in srgb,var(--kn-e-accent) 55%,transparent)}
.kn-e[data-border=double]{border:calc(var(--dna-stroke,1px) * 3) double var(--kn-e-accent)}
.kn-e[data-border=dashed]{border:var(--dna-stroke,1px) dashed var(--kn-e-accent)}
.kn-e[data-border=glow]{border:var(--dna-stroke,1px) solid var(--kn-e-accent);
box-shadow:0 0 0 1px color-mix(in srgb,var(--kn-e-accent) 30%,transparent),0 0 22px -8px var(--kn-e-accent)}
.kn-e button{font:inherit;color:inherit;min-height:44px;min-width:44px;cursor:pointer}
.kn-e :focus-visible{outline:2px solid var(--dna-accent,currentColor);outline-offset:2px}
.kn-e button:focus:not(:focus-visible){outline:none}
.kn-e-muted{color:var(--dna-muted,#b4b4b4)}
.kn-e[data-tier=reduced],.kn-e[data-tier=reduced] *{animation:none!important;transition:none!important}
@media (prefers-reduced-motion:reduce){.kn-e,.kn-e *{animation:none!important;transition:none!important}}`;

export interface EngineFrame {
  /** `.kn-e.kn-e-<id>` card root (carries data-engine / data-layout / data-tier / data-state). */
  root: HTMLElement;
  /** `.kn-e-body` content wrapper above the ornament layer: put engine content here. */
  body: HTMLElement;
}

export interface FrameOptions {
  /** Paint the DNA / blueprint surface tile (default true). */
  surface?: boolean;
  /** Mount the ornament layer (default true). */
  ornament?: boolean;
  /** Root element tag (default div). */
  tag?: 'div' | 'aside' | 'section' | 'article' | 'figure';
  /** Accessible name for the card. */
  label?: string;
  /** Layout actually used (defaults to blueprint.visual.layout). */
  layout?: string;
}

export function mountFrame(
  host: HTMLElement,
  blueprint: GimmickBlueprint,
  ctx: EngineRuntimeContext,
  opts: FrameOptions = {},
): EngineFrame {
  injectEngineStyle('kn-e-base', BASE_CSS);
  const v = blueprint.visual;
  const id = blueprint.engine;
  const layout = opts.layout ?? v.layout;
  const root = el(opts.tag ?? 'div', {
    class: `kn-e ${cls(id)} ${cls(id)}--${layout}`,
    'data-engine': id,
    'data-blueprint': blueprint.id,
    'data-layout': layout,
    'data-tier': ctx.tier,
    'data-border': v.borderStyle,
    'data-motion': v.motionPreset,
    'data-state': 'idle',
    'aria-label': opts.label,
  });
  root.style.setProperty('--kn-e-accent', accentVar(v.accentRole));
  if (opts.surface !== false) {
    const material = v.surface && v.surface !== 'inherit' ? v.surface : ctx.dna.surface.material;
    // The reading root carries `--dna-tile-<material>` (re-baked on every light/dark switch), so
    // mounted cards swap tiles live; the context's own tile is the fallback (sheets, tests).
    const tile = material === 'clean' ? 'none' : ctx.surfaceTile(material);
    root.style.setProperty('--kn-e-tile', `var(--dna-tile-${material},${tile})`);
  }
  if (opts.ornament !== false) {
    root.append(ctx.ornamentSvg(v.ornament === 'inherit' ? ctx.dna.ornament.grammar : v.ornament));
  }
  const body = el('div', { class: 'kn-e-body' });
  root.append(body);
  ctx.onTierChange((t) => (root.dataset.tier = t));
  host.append(root);
  return { root, body };
}

/** True when the engine must render its calm static form (reduced tier or Calm Mode). */
export const isStill = (ctx: Pick<EngineRuntimeContext, 'tier' | 'calm'>): boolean =>
  ctx.tier === 'reduced' || ctx.calm;

/** `props[key]` when it is an allowed variant, else the blueprint layout, else the first one. */
export function variantOf<T extends string>(
  blueprint: GimmickBlueprint,
  props: BlueprintProps,
  key: string,
  allowed: readonly T[],
): T {
  const want = props[key];
  if (typeof want === 'string' && (allowed as readonly string[]).includes(want)) return want as T;
  const layout = blueprint.visual.layout;
  return (allowed as readonly string[]).includes(layout) ? (layout as T) : allowed[0]!;
}

/** Pausable wait on the context clock; resolves early (never rejects) when the block unmounts. */
export function wait(ctx: EngineRuntimeContext, ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (ctx.signal.aborted) return resolve();
    const cancel = ctx.timeout(resolve, ms);
    ctx.signal.addEventListener('abort', () => (cancel(), resolve()), { once: true });
  });
}

/** Plays the blueprint's sound + haptic recipe, unless still, muted or `props.sound === false`. */
export function cue(
  ctx: EngineRuntimeContext,
  blueprint: GimmickBlueprint,
  props: BlueprintProps,
): void {
  if (isStill(ctx) || props.sound === false) return;
  if (blueprint.sound) {
    ctx.audio.stinger(blueprint.sound.patch, {
      gain: blueprint.sound.gain,
      pitchShift: blueprint.sound.pitchShift,
    });
  }
  if (blueprint.haptics && blueprint.haptics !== 'none') ctx.haptics(blueprint.haptics);
}

/** Stagger delay for item `i` in ms, scaled by the DNA motion tempo (0 when still). */
export function stagger(ctx: EngineRuntimeContext, i: number, stepMs = 60): number {
  if (isStill(ctx) || ctx.dna.motion.personality === 'still') return 0;
  return Math.round((i * stepMs) / ctx.dna.motion.tempo);
}

export type { EngineTier };
