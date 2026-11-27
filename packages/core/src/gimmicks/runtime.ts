// The frozen host contract every v2 engine receives. The reader builds one per mounted block
// (apps/reader/src/runtime-context.ts) and owns all teardown: frames, timers, listeners and
// audio registered through it are released on unmount, so engines carry no leak plumbing.
// Types only; zero dependencies.
import type { OrnamentGrammar, ResolvedVisualDna, SurfaceMaterial } from '../dna/types.ts';
import type {
  BlueprintProps,
  EngineId,
  GimmickBlueprint,
  HapticPattern,
  StingerPatch,
} from './types.ts';

export type EngineTier = 'high' | 'lite' | 'reduced';
export type Unsubscribe = () => void;

export interface StingerOptions {
  gain?: number;
  pitchShift?: number;
}

export interface EngineAudio {
  /** False in `reduced`, Calm Mode, silent mode, `sonic.timbre: 'silent'` or before unlock. */
  readonly enabled: boolean;
  /** One-shot procedural stinger (≤ 0.35 s) shaped by `dna.sonic.timbre`. No-op when disabled. */
  stinger(patch: StingerPatch, options?: StingerOptions): void;
}

export interface EngineRuntimeContext {
  /** Current tier; changes live (Calm Mode, writer tier switch) without remounting. */
  readonly tier: EngineTier;
  /** Calm Mode / OS reduced motion. Always implies tier `reduced` and silent audio. */
  readonly calm: boolean;
  readonly paused: boolean;
  /** Aborted when the block unmounts; tie any extra DOM listeners to it. */
  readonly signal: AbortSignal;
  readonly dna: ResolvedVisualDna;

  onPause(cb: () => void): Unsubscribe;
  onResume(cb: () => void): Unsubscribe;
  /** Fires after `tier` changed (e.g. high → reduced on `kn:tier-change`). Downgrade in place. */
  onTierChange(cb: (tier: EngineTier) => void): Unsubscribe;

  /** One-shot animation frame (re-request each frame). Deferred while paused. `t` in ms. */
  raf(cb: (tMs: number) => void): Unsubscribe;
  /** Tracked one-shot timer; its remaining time is held while paused. */
  timeout(cb: () => void, ms: number): Unsubscribe;
  /** Tracked repeating timer; silent while paused. */
  interval(cb: () => void, ms: number): Unsubscribe;

  readonly audio: EngineAudio;
  /** Vibration; a no-op in `reduced`, Calm Mode or on devices without one. */
  haptics(pattern: HapticPattern): void;
  /** Cached 128×128 tile for the current theme as a CSS `url(data:…)` value, or `'none'`. */
  surfaceTile(material: SurfaceMaterial): string;
  /** Absolute `inset: 0` SVG ornament layer in `currentColor` (pointer-events: none). */
  ornamentSvg(grammar: OrnamentGrammar): SVGSVGElement;
}

export interface EngineInstance {
  /** Plays the beat; resolves once it has landed (immediately in `reduced`). */
  trigger(): Promise<void>;
  /** Removes every node the engine created. The context releases its own resources. */
  destroy(): void;
}

export interface GimmickEngine {
  readonly id: EngineId;
  mount(
    host: HTMLElement,
    blueprint: GimmickBlueprint,
    props: BlueprintProps,
    ctx: EngineRuntimeContext,
  ): EngineInstance;
}
