import type { StageLook } from '@ie/story';
import type { Rgb } from './actors.ts';
import type { FxState } from './fx.ts';
import type { OverlayUniforms } from './renderer.ts';

export interface LookSettings {
  readonly vignette: number;
  readonly grain: number;
  readonly scanlines: number;
  /** Chromatic aberration on sprites (rich post only). */
  readonly aberration: number;
  readonly tint: number;
  /** Soft glow around title glyphs. */
  readonly glow: number;
}

/** Looks as overlay settings: what the reader sees over everything, text included. */
export const LOOKS: Readonly<Record<StageLook, LookSettings>> = {
  none: { vignette: 0, grain: 0, scanlines: 0, aberration: 0, tint: 0, glow: 0 },
  film: { vignette: 0.35, grain: 0.07, scanlines: 0, aberration: 0, tint: 0, glow: 0 },
  crt: { vignette: 0.3, grain: 0.04, scanlines: 0.1, aberration: 0.7, tint: 0, glow: 0 },
  noir: { vignette: 0.55, grain: 0.06, scanlines: 0, aberration: 0, tint: 0.1, glow: 0 },
  dream: { vignette: 0.2, grain: 0, scanlines: 0, aberration: 0, tint: 0.06, glow: 0.35 },
};

/** Transition kinds as the overlay shader's cover modes. */
export const COVER = { dissolve: 1, ink: 2, wipe: 3 } as const;

export interface Cover {
  readonly kind: number;
  readonly seconds: number;
  /** Progress 0..1: covering until 0.5, uncovering after. */
  t: number;
  readonly color: Rgb;
  covered?: () => void;
}

const NONE = [0, 0, 0, 0] as const;

/** The overlay pass for this frame: the look, the flash and any transition cover. */
export function overlayUniforms(
  name: StageLook,
  fx: FxState,
  cover: Cover | null,
  accent: Rgb,
  rich: boolean,
): OverlayUniforms {
  const look = LOOKS[name];
  // Dream warms toward the theme's accent; noir only darkens.
  const tint: Rgb = name === 'dream' ? accent : [0, 0, 0];
  const f = fx.flashAmount;
  return {
    flash: [fx.flash[0] * f, fx.flash[1] * f, fx.flash[2] * f, f],
    tint:
      look.tint > 0
        ? [tint[0] * look.tint, tint[1] * look.tint, tint[2] * look.tint, look.tint]
        : NONE,
    vignette: look.vignette,
    grain: rich ? look.grain : 0,
    scanlines: rich ? look.scanlines : 0,
    cover: cover
      ? [cover.color[0], cover.color[1], cover.color[2], 1 - Math.abs(cover.t * 2 - 1)]
      : NONE,
    coverKind: cover ? cover.kind : 0,
  };
}
