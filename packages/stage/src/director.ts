import {
  backgroundSetSchema,
  lookSetSchema,
  type BackgroundSet,
  type Burst,
  type Flash,
  type Label,
  type LookSet,
  type StageColor,
  type Title,
  type Transition,
} from '@ie/story';
import type { Rgb } from './actors.ts';
import type { FxState } from './fx.ts';
import { Stage, type StagePalette } from './stage.ts';
import type { StageLayer } from './layer.ts';
import { detectTier, type TierName } from './tiers.ts';

export interface StageDirectorOptions {
  /** Where the stage canvas goes; it is created on the first stage action. */
  readonly mount: () => HTMLElement | null;
  readonly family: string;
  readonly palette: () => StagePalette;
  readonly reducedMotion: () => boolean;
  /** The title in the reader's language. */
  readonly text: (label: Label) => string;
  /** Says a title to screen readers (the stage itself is invisible to them). */
  readonly announce?: (text: string) => void;
  readonly onFx?: (fx: FxState) => void;
  readonly beatPhase?: () => number | null;
  /** Overrides tier detection (the Studio's stage view lets the author pick one). */
  readonly tier?: TierName;
  /** Class of the canvas: `ie-stage` covers the window, `ie-stage ie-stage--contained` a panel. */
  readonly canvasClass?: string;
}

/** The GPU's name where the browser will tell, for picking a starting tier. */
export function gpuRenderer(gl: WebGL2RenderingContext): string | undefined {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : undefined;
}

const NAMED: Readonly<Record<Exclude<StageColor, 'ink' | 'accent'>, Rgb>> = {
  white: [1, 1, 1],
  red: [0.9, 0.2, 0.2],
  gold: [1, 0.78, 0.3],
  blue: [0.35, 0.6, 1],
};

/** A named stage colour: the theme's ink or accent, or a fixed hue. */
export function stageColor(name: StageColor, palette: StagePalette): Rgb {
  if (name === 'ink') return palette.ink;
  if (name === 'accent') return palette.accent;
  return NAMED[name];
}

/**
 * Turns stage actions into stage calls, and builds the stage only when a novel first uses it, so a
 * novel without stage blocks never creates a GPU context. Backgrounds and looks are scene state:
 * `applyScene` restores them after a load or a rewind.
 */
export class StageDirector {
  private current: Stage | null = null;
  private failed = false;
  private canvas: HTMLCanvasElement | null = null;

  constructor(private readonly options: StageDirectorOptions) {}

  get stage(): Stage | null {
    return this.current;
  }

  private color(name: StageColor | undefined, palette: StagePalette): Rgb | undefined {
    return name ? stageColor(name, palette) : undefined;
  }

  /** The stage, created on first use; null where WebGL2 is missing (the story goes on without it). */
  ensure(): Stage | null {
    if (this.current || this.failed) return this.current;
    const host = this.options.mount();
    if (!host) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.className = this.options.canvasClass ?? 'ie-stage';
      canvas.setAttribute('aria-hidden', 'true');
      host.append(canvas);
      this.canvas = canvas;
      // Probed on a spare canvas: the first getContext call fixes the stage's context attributes.
      const probe = document.createElement('canvas').getContext('webgl2');
      const tier =
        this.options.tier ??
        detectTier({
          ...(probe ? { renderer: gpuRenderer(probe) } : {}),
          mobile: matchMedia('(pointer: coarse)').matches,
          cores: navigator.hardwareConcurrency,
        });
      this.current = new Stage(canvas, {
        family: this.options.family,
        tier,
        reducedMotion: this.options.reducedMotion(),
        palette: this.options.palette,
        ...(this.options.onFx ? { onFx: this.options.onFx } : {}),
        ...(this.options.beatPhase ? { beatPhase: this.options.beatPhase } : {}),
      });
    } catch (error) {
      console.warn('The stage is unavailable.', error);
      this.failed = true;
      this.canvas?.remove();
      this.canvas = null;
    }
    return this.current;
  }

  backgroundSet(params: BackgroundSet): void {
    // Turning a background off needs no stage if there isn't one yet.
    if (params.preset === 'none' && !this.current) return;
    this.ensure()?.setBackground(params.preset, params.amount ?? 1);
  }

  lookSet(params: LookSet): void {
    if (params.look === 'none' && !this.current) return;
    this.ensure()?.setLook(params.look);
  }

  shake(strength: number): void {
    this.ensure()?.shake(strength);
  }

  flash(params: Flash): void {
    const stage = this.ensure();
    stage?.flash(this.color(params.color, this.options.palette()) ?? [1, 1, 1]);
  }

  hitStop(seconds: number): void {
    this.ensure()?.hitStop(seconds);
  }

  burst(params: Burst): void {
    const stage = this.ensure();
    const color = this.color(params.color, this.options.palette());
    stage?.burst(params.preset, {
      ...(params.glyphs ? { glyphs: params.glyphs } : {}),
      ...(color ? { color } : {}),
    });
  }

  title(params: Title): void {
    const text = this.options.text(params.text);
    if (!text.trim()) return;
    this.options.announce?.(text);
    const color = this.color(params.color, this.options.palette());
    this.ensure()?.title(text, {
      ...(params.seconds ? { seconds: params.seconds } : {}),
      ...(params.exit ? { exit: params.exit } : {}),
      ...(color ? { color } : {}),
    });
  }

  transition(params: Transition): void {
    this.ensure()?.transition(params.kind, params.seconds ?? 1.2);
  }

  /** Restores backgrounds and looks from saved scene state, and drops moments in flight. */
  applyScene(scene: Readonly<Record<string, unknown>>): void {
    const background = backgroundSetSchema.safeParse(scene['stage.background.set']);
    const look = lookSetSchema.safeParse(scene['stage.look.set']);
    this.current?.clearMoments();
    this.backgroundSet(background.success ? background.data : { preset: 'none' });
    this.lookSet(look.success ? look.data : { look: 'none' });
  }

  /** Moves the stage into another panel (the Studio's Play and Stage views), or out of view. */
  attach(parent: HTMLElement | null): void {
    if (!this.canvas) return;
    if (parent) parent.append(this.canvas);
    else this.canvas.remove();
  }

  /** Draws a layer every frame (a rhythm fight); false when there is no stage to draw on. */
  setLayer(layer: StageLayer | null): boolean {
    const stage = layer ? this.ensure() : this.current;
    stage?.setLayer(layer);
    return stage !== null;
  }

  /** Pins a quality tier for previewing, or returns to automatic with null. */
  setTier(tier: TierName | null): void {
    this.ensure()?.setTier(tier);
  }

  setReducedMotion(on: boolean): void {
    this.current?.setReducedMotion(on);
  }

  refreshPalette(): void {
    this.current?.refreshPalette();
  }

  dispose(): void {
    this.current?.dispose();
    this.current = null;
    this.canvas?.remove();
    this.canvas = null;
  }
}
