// Web-only half of the module contract, exposed as `@kn/core/renderer`. Only `renderer.ts`
// files and the reader import this; the native writer never does (CLAUDE.md §3.3).
import type { PerspectiveCamera, Scene, WebGLRenderer } from 'three';

export type QualityTier = 'high' | 'lite' | 'reduced';
export const qualityTiers: readonly QualityTier[] = ['high', 'lite', 'reduced'];

/** Visible half-extents of the z=0 "page" plane in world units, already inset by safe areas. */
export interface WorldBounds {
  halfWidth: number;
  halfHeight: number;
}

/**
 * A lease on the singleton transparent WebGL stage. The camera looks down -Z at the z=0 page
 * plane with +Y up. Add your own Group to `scene`, remove it and dispose your GPU resources
 * before calling `release()`.
 */
export interface GLStageLease {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: PerspectiveCamera;
  bounds(): WorldBounds;
  /** Runs every animation frame while subscribed; the stage renders after all callbacks. */
  onFrame(callback: (dtSeconds: number, timeSeconds: number) => void): () => void;
  release(): void;
}

export interface StageAccess {
  /** Fixed full-viewport layer (pointer-events: none) for 2D canvas / CSS spectacles. */
  readonly overlay: HTMLElement;
  /** Lazily creates (or reuses) the one shared WebGL renderer. Rejects when WebGL is unavailable. */
  acquireGL(): Promise<GLStageLease>;
}

/** A playing ambient bed; `stop(atTime)` schedules its sources to end at an AudioContext time. */
export interface AmbientSource {
  stop(atTime: number): void;
}

export interface AmbientOptions {
  volume: number;
  fadeSeconds: number;
}

export interface AudioBusAccess {
  /** Null while silent mode is on or before the first-tap unlock. Always check. */
  readonly context: AudioContext | null;
  /** Destination for one-shot SFX (sits after the duck stage). Null when `context` is null. */
  readonly sfx: AudioNode | null;
  /** Crossfades to a new ambient bed. Re-sending the current key only retunes its volume. */
  setAmbient(
    key: string,
    build: (ctx: AudioContext, out: AudioNode) => AmbientSource,
    options: AmbientOptions,
  ): void;
  stopAmbient(fadeSeconds: number): void;
  /** Briefly lowers the ambient bed so a one-shot cuts through. */
  duck(amount: number, seconds: number): void;
}

export interface RendererContext<P> {
  readonly props: P;
  readonly tier: QualityTier;
  readonly blockId: string;
  /** This block's slot in the reading column. Inline modules render here. */
  readonly host: HTMLElement;
  readonly stage: StageAccess;
  readonly audio: AudioBusAccess;
  /** Aborted when the host disposes the renderer; tie listeners and timers to it. */
  readonly signal: AbortSignal;
  /** Resolves a novel-relative asset path to a URL. */
  resolveAsset(path: string): string;
}

export interface ModuleRenderer<P> {
  /** Optional warm-up (fetch assets, compile) before the block scrolls into view. */
  preload?(props: P, tier: QualityTier): Promise<void>;
  /** Mounts the `high` or `lite` spectacle (read `ctx.tier`). */
  mount(ctx: RendererContext<P>): void | Promise<void>;
  /** Mandatory calm path for `reduced`: no strobes, no shake, an instant readable reveal. */
  reducedMotionFallback(ctx: RendererContext<P>): void | Promise<void>;
  /** Plays the beat. Resolves once the spectacle has landed, so beat-stops can wait for it. */
  trigger?(): Promise<void>;
  update?(props: P): void;
  /** Must remove every DOM node, listener, audio node and GPU resource the renderer created. */
  dispose(): void;
}

export type ModuleRendererFactory<P> = () => ModuleRenderer<P>;
