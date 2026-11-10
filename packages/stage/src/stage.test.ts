import { describe, expect, it } from 'vitest';
import { ShelfPacker, type AtlasGlyph } from './atlas.ts';
import { parseCssColor } from './color.ts';
import { MAX_FLASHES_PER_SECOND, ScreenFx } from './fx.ts';
import { PARTICLE_PRESETS, ParticleSystem } from './particles.ts';
import { distanceTransform, sdfFromCoverage } from './sdf.ts';
import { layoutText, type Metrics } from './text.ts';
import { detectTier, FrameGovernor } from './tiers.ts';

describe('signed distance fields', () => {
  it('computes exact squared distances to the nearest feature', () => {
    const w = 5;
    const grid = new Float64Array(w * w).fill(1e20);
    grid[12] = 0; // the centre
    distanceTransform(grid, w, w);
    expect(grid[12]).toBe(0);
    expect(grid[13]).toBe(1);
    expect(grid[18]).toBe(2);
    expect(grid[0]).toBe(8);
  });

  it('puts the edge of a filled square at 3/4 and falls off outside', () => {
    const w = 32;
    const alpha = new Uint8Array(w * w);
    for (let y = 8; y < 24; y++) for (let x = 8; x < 24; x++) alpha[y * w + x] = 255;
    const sdf = sdfFromCoverage(alpha, w, w, 8);
    const at = (x: number, y: number) => sdf[y * w + x] ?? 0;
    expect(at(16, 16)).toBeGreaterThan(240);
    expect(at(8, 16)).toBeGreaterThan(191 - 20);
    expect(at(8, 16)).toBeLessThan(191 + 40);
    expect(at(2, 16)).toBeLessThan(at(6, 16));
    expect(at(0, 0)).toBe(0);
  });
});

describe('the glyph atlas packer', () => {
  it('fills rows left to right and starts a new row when full', () => {
    const p = new ShelfPacker(10, 0);
    expect(p.place(4, 3)).toEqual({ x: 0, y: 0 });
    expect(p.place(4, 5)).toEqual({ x: 4, y: 0 });
    expect(p.place(4, 2)).toEqual({ x: 0, y: 5 });
    expect(p.height).toBe(7);
  });
});

describe('stage text layout', () => {
  // Every letter 10 wide at size 10, a 10×10 bitmap with no margin.
  const glyph: AtlasGlyph = { x: 0, y: 0, w: 10, h: 10, left: 0, top: 8, advance: 10 };
  const space: AtlasGlyph = { ...glyph, w: 0, h: 0 };
  const metrics: Metrics = {
    size: 10,
    ascent: 8,
    descent: 2,
    get: (c) => (c === ' ' ? space : glyph),
  };

  it('centres a line on the given point', () => {
    const placed = layoutText('ab', metrics, { size: 10, maxWidth: 100, x: 50, y: 50 });
    expect(placed.map((g) => g.x)).toEqual([45, 55]);
  });

  it('wraps at spaces and keeps letters in reading order', () => {
    const placed = layoutText('aa bb cc', metrics, { size: 10, maxWidth: 55, x: 0, y: 0 });
    const rows = new Set(placed.map((g) => g.y));
    expect(rows.size).toBe(2);
    expect(placed.map((g) => g.index)).toEqual([0, 1, 3, 4, 5, 6]);
  });

  it('scales letters with the font size', () => {
    const [a] = layoutText('a', metrics, { size: 20, maxWidth: 100, x: 0, y: 0 });
    expect(a?.hw).toBe(10);
  });
});

describe('screen effects', () => {
  it('allows only a few flashes a second', () => {
    const fx = new ScreenFx();
    let shown = 0;
    for (let i = 0; i < 10; i++) {
      if (fx.flash()) shown++;
      fx.update(0.05);
    }
    expect(shown).toBe(MAX_FLASHES_PER_SECOND);
    fx.update(1);
    expect(fx.flash()).toBe(true);
  });

  it('freezes story time during hit-stop, then lets it run', () => {
    const fx = new ScreenFx();
    fx.hitStop(0.1);
    expect(fx.update(0.05).timeScale).toBe(0);
    expect(fx.update(0.1).timeScale).toBe(1);
  });

  it('shakes, settles, and never shakes under reduced motion', () => {
    const fx = new ScreenFx();
    fx.shake(1);
    const moved = fx.update(0.016);
    expect(Math.abs(moved.offsetX) + Math.abs(moved.offsetY)).toBeGreaterThan(0);
    for (let i = 0; i < 100; i++) fx.update(0.016);
    expect(fx.active).toBe(false);
    const still = new ScreenFx({ reducedMotion: true });
    still.shake(1);
    const s = still.update(0.016);
    expect(Math.abs(s.offsetX)).toBe(0);
    expect(Math.abs(s.offsetY)).toBe(0);
  });
});

describe('quality tiers', () => {
  it('starts the reference phone at medium and software renderers at low', () => {
    expect(
      detectTier({ renderer: 'ANGLE (Qualcomm, Adreno (TM) 610, OpenGL ES 3.2)', mobile: true }),
    ).toBe('medium');
    expect(detectTier({ renderer: 'Adreno (TM) 506', mobile: true })).toBe('low');
    expect(detectTier({ renderer: 'Google SwiftShader', mobile: false })).toBe('low');
    expect(detectTier({ renderer: 'ANGLE (NVIDIA GeForce RTX 3060)', mobile: false })).toBe('high');
  });

  it('steps down after five seconds of slow frames and back up after a long calm', () => {
    const g = new FrameGovernor('high', { ceiling: 'high' });
    let changed = null;
    for (let t = 0; t < 6000 && !changed; t += 25) changed = g.frame(25);
    expect(changed).toBe('medium');
    let up = null;
    for (let t = 0; t < 40000 && !up; t += 8) up = g.frame(8);
    expect(up).toBe('high');
  });

  it('ignores long gaps such as a hidden tab', () => {
    const g = new FrameGovernor('medium');
    for (let i = 0; i < 100; i++) expect(g.frame(1000)).toBeNull();
  });
});

describe('glyph particles', () => {
  it('emits up to capacity, ages out, and keeps live particles packed', () => {
    const p = new ParticleSystem(50, 3);
    expect(p.emit(PARTICLE_PRESETS.burst, { x: 0, y: 0 }, 80)).toBe(50);
    expect(p.count).toBe(50);
    p.update(0.3);
    expect(p.count).toBe(50);
    for (let i = 0; i < 20; i++) p.update(0.1);
    expect(p.count).toBe(0);
  });

  it('is deterministic for a seed', () => {
    const a = new ParticleSystem(10, 7);
    const b = new ParticleSystem(10, 7);
    a.emit(PARTICLE_PRESETS.sparks, { x: 5, y: 5 });
    b.emit(PARTICLE_PRESETS.sparks, { x: 5, y: 5 });
    a.update(0.1);
    b.update(0.1);
    expect([...a.x]).toEqual([...b.x]);
  });
});

describe('theme colours', () => {
  it('reads hex and rgb tokens', () => {
    expect(parseCssColor('#ff0000')).toEqual([1, 0, 0]);
    expect(parseCssColor('#0f0')).toEqual([0, 1, 0]);
    expect(parseCssColor('rgb(0 0 255 / 0.5)')).toEqual([0, 0, 1]);
    expect(parseCssColor('nonsense', [0, 0, 0])).toEqual([0, 0, 0]);
  });
});
