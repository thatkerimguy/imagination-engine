import { describe, expect, it } from 'vitest';
import type { FxState } from './fx.ts';
import { COVER, overlayUniforms } from './looks.ts';

const still: FxState = {
  offsetX: 0,
  offsetY: 0,
  angle: 0,
  zoom: 0,
  flash: [1, 1, 1],
  flashAmount: 0,
  timeScale: 1,
};

describe('overlay uniforms', () => {
  it('draws nothing for the plain look with no flash or cover', () => {
    const u = overlayUniforms('none', still, null, [1, 0, 0], true);
    expect(u.flash[3]).toBe(0);
    expect(u.tint).toEqual([0, 0, 0, 0]);
    expect(u.vignette).toBe(0);
    expect(u.cover[3]).toBe(0);
    expect(u.coverKind).toBe(0);
  });

  it('premultiplies the flash and tints dream toward the accent', () => {
    const u = overlayUniforms('dream', { ...still, flashAmount: 0.5 }, null, [1, 0.5, 0], true);
    expect(u.flash).toEqual([0.5, 0.5, 0.5, 0.5]);
    expect(u.tint[0]).toBeCloseTo(0.06);
    expect(u.tint[1]).toBeCloseTo(0.03);
    expect(u.tint[3]).toBeCloseTo(0.06);
  });

  it('drops grain and scanlines without rich post', () => {
    const rich = overlayUniforms('crt', still, null, [0, 0, 0], true);
    const plain = overlayUniforms('crt', still, null, [0, 0, 0], false);
    expect(rich.scanlines).toBeGreaterThan(0);
    expect(plain.scanlines).toBe(0);
    expect(plain.grain).toBe(0);
    expect(plain.vignette).toBe(rich.vignette);
  });

  it('covers fully at the middle of a transition', () => {
    const cover = { kind: COVER.ink, seconds: 1, t: 0.5, color: [0, 0, 0] as const };
    expect(overlayUniforms('none', still, cover, [0, 0, 0], true).cover[3]).toBe(1);
    expect(overlayUniforms('none', still, { ...cover, t: 0 }, [0, 0, 0], true).cover[3]).toBe(0);
  });
});
