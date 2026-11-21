// Schema, card, flame math and ignite/extinguish coordination under a minimal fake DOM
// (vitest runs in node; there is no jsdom in the workspace).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QualityTier, RendererContext } from '@kn/core/renderer';
import { formatCardSummary } from './card.ts';
import { hasActiveFlame } from './controller.ts';
import { MAX_DT, MAX_TILT_DEG, breeze, clampDt, flicker, gammaToAngle, stepSway } from './flame.ts';
import createRenderer from './renderer.ts';
import { meta, schema, type LighterProps } from './schema.ts';

class FakeEl extends EventTarget {
  textContent = '';
  className = '';
  type = '';
  dataset: Record<string, string> = {};
  attrs: Record<string, string> = {};
  parent: FakeEl | null = null;
  children: FakeEl[] = [];
  style = { setProperty: (): void => undefined } as unknown as CSSStyleDeclaration & {
    opacity: string;
  };
  classList = { add: (): void => undefined };
  append(...nodes: FakeEl[]): void {
    for (const n of nodes) {
      n.parent = this;
      this.children.push(n);
    }
  }
  replaceChildren(): void {
    this.children = [];
  }
  remove(): void {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }
  setAttribute(k: string, v: string): void {
    this.attrs[k] = v;
  }
  getContext(): null {
    return null;
  }
}

const g = globalThis as unknown as Record<string, unknown>;
let head: FakeEl;

beforeEach(() => {
  vi.useFakeTimers();
  head = new FakeEl();
  g.window = new EventTarget();
  g.document = {
    head,
    hidden: false,
    createElement: () => new FakeEl(),
    createElementNS: () => new FakeEl(),
  };
  g.requestAnimationFrame = () => 1;
  g.cancelAnimationFrame = () => undefined;
});

afterEach(() => {
  vi.useRealTimers();
  for (const k of ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame'])
    Reflect.deleteProperty(g, k);
});

function props(over: Partial<LighterProps> = {}): LighterProps {
  return { ...schema.defaults, ...over };
}

function make(overlay: FakeEl, p: LighterProps, tier: QualityTier = 'lite') {
  const ac = new AbortController();
  const host = new FakeEl();
  const ctx = {
    props: p,
    tier,
    blockId: 'b',
    host,
    stage: { overlay, acquireGL: () => Promise.reject(new Error('no gl')) },
    audio: { context: null, sfx: null, setAmbient() {}, stopAmbient() {}, duck() {} },
    signal: ac.signal,
    resolveAsset: (s: string) => s,
  } as unknown as RendererContext<LighterProps>;
  const r = createRenderer();
  void r.mount(ctx);
  return { r, host, ac };
}

describe('schema and card', () => {
  it('has the expected meta and defaults', () => {
    expect(meta).toMatchObject({ id: 'bl-lighter-flick', layer: 'overlay-vfx', version: 1 });
    expect(schema.validate({})).toEqual({ ok: true, props: schema.defaults });
    expect(schema.defaults).toMatchObject({ action: 'ignite', warmth: 0.75, autoExtinguishMs: 0 });
  });

  it('rejects out-of-range values', () => {
    expect(schema.validate({ warmth: 0.1 }).ok).toBe(false);
    expect(schema.validate({ warmth: 1.5 }).ok).toBe(false);
    expect(schema.validate({ autoExtinguishMs: 250 }).ok).toBe(false);
    expect(schema.validate({ autoExtinguishMs: 31000 }).ok).toBe(false);
    expect(schema.validate({ corner: 'top' }).ok).toBe(false);
    expect(schema.validate({ autoExtinguishMs: 4000, warmth: 0.5 }).ok).toBe(true);
  });

  it('only shows ignite settings for ignite', () => {
    const shown = schema.fields.filter((f) => f.showWhen).map((f) => f.key);
    expect(shown).toEqual(['corner', 'trigger', 'warmth', 'autoExtinguishMs']);
    expect(schema.fields.every((f) => !f.showWhen || f.showWhen.equals === 'ignite')).toBe(true);
    expect(schema.fields.find((f) => f.key === 'sfx')?.showWhen).toBeUndefined();
  });

  it('summarises cards', () => {
    expect(formatCardSummary(props())).toEqual({
      title: '🔥 Ignite · Bottom right',
      subtitle: 'Auto · burns until extinguished',
      badge: 'SFX',
    });
    expect(
      formatCardSummary(
        props({ corner: 'bottom-left', trigger: 'tap', autoExtinguishMs: 4000, sfx: false }),
      ),
    ).toEqual({
      title: '🔥 Ignite · Bottom left',
      subtitle: 'Tap · out after 4s',
    });
    expect(formatCardSummary(props({ action: 'extinguish' }))).toEqual({
      title: '🔥 Extinguish',
      subtitle: 'Snaps the lid shut',
      badge: 'SFX',
    });
  });
});

describe('flame math', () => {
  it('clamps tilt to the allowed range', () => {
    expect(gammaToAngle(90)).toBe(-MAX_TILT_DEG);
    expect(gammaToAngle(-90)).toBe(MAX_TILT_DEG);
    expect(gammaToAngle(10)).toBeCloseTo(-8);
    expect(Math.abs(breeze(123.4))).toBeLessThanOrEqual(MAX_TILT_DEG);
    expect(flicker(1)).toBeGreaterThan(0.8);
  });

  it('steps the sway spring toward the target with dt clamped', () => {
    expect(clampDt(5)).toBe(MAX_DT);
    expect(clampDt(-1)).toBe(0);
    let s = { angle: 0, velocity: 0 };
    for (let i = 0; i < 120; i++) s = stepSway(s, 15, 1 / 60);
    expect(s.angle).toBeCloseTo(15, 0);
    expect(stepSway({ angle: 0, velocity: 0 }, 100, 10).angle).toBe(
      stepSway({ angle: 0, velocity: 0 }, 100, MAX_DT).angle,
    );
    expect(stepSway({ angle: 21.9, velocity: 500 }, 22, 0.05).angle).toBeLessThanOrEqual(
      MAX_TILT_DEG,
    );
  });
});

describe('ignite and extinguish', () => {
  it('ignites on trigger, not mount, and resolves before it goes out', async () => {
    const overlay = new FakeEl();
    const { r } = make(overlay, props(), 'high');
    expect(overlay.children).toHaveLength(0);
    const done = r.trigger!();
    expect(overlay.children).toHaveLength(1);
    expect(overlay.children[0]!.attrs['data-kn-lighter']).toBe('lit');
    expect(hasActiveFlame()).toBe(true);
    await vi.advanceTimersByTimeAsync(800);
    await done;
    expect(overlay.children).toHaveLength(1);
    r.dispose();
    expect(overlay.children).toHaveLength(0);
    expect(hasActiveFlame()).toBe(false);
  });

  it('an extinguish block fades the flame out, then removes it', async () => {
    const overlay = new FakeEl();
    const a = make(overlay, props());
    const b = make(overlay, props({ action: 'extinguish' }));
    const lit = a.r.trigger!();
    await vi.advanceTimersByTimeAsync(800);
    await lit;
    const out = b.r.trigger!();
    expect(overlay.children[0]!.attrs['data-kn-lighter']).toBe('out');
    expect(hasActiveFlame()).toBe(false);
    await vi.advanceTimersByTimeAsync(230);
    await out;
    expect(overlay.children).toHaveLength(0);
    b.r.dispose();
    a.r.dispose();
  });

  it('extinguish with nothing lit resolves immediately', async () => {
    const { r } = make(new FakeEl(), props({ action: 'extinguish' }));
    await r.trigger!();
    r.dispose();
  });

  it('a new ignite replaces the old flame instantly', async () => {
    const overlay = new FakeEl();
    const a = make(overlay, props());
    const b = make(overlay, props({ corner: 'bottom-left' }));
    void a.r.trigger!();
    void b.r.trigger!();
    expect(overlay.children).toHaveLength(1);
    a.r.dispose();
    expect(overlay.children).toHaveLength(1);
    expect(hasActiveFlame()).toBe(true);
    b.r.dispose();
    expect(overlay.children).toHaveLength(0);
  });

  it('autoExtinguishMs puts the flame out on its own', async () => {
    const overlay = new FakeEl();
    const { r } = make(overlay, props({ autoExtinguishMs: 2000 }), 'reduced');
    await Promise.all([r.trigger!(), vi.advanceTimersByTimeAsync(200)]);
    expect(overlay.children).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(overlay.children).toHaveLength(0);
    expect(hasActiveFlame()).toBe(false);
    r.dispose();
  });

  it('tap trigger waits for the cue click and cleans it up', async () => {
    const overlay = new FakeEl();
    const { r, host } = make(overlay, props({ trigger: 'tap' }));
    const done = r.trigger!();
    const cue = host.children[0]!;
    expect(cue.textContent).toBe('🔥 Flick lighter');
    expect(overlay.children).toHaveLength(0);
    cue.dispatchEvent(new Event('click'));
    expect(host.children).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(0);
    expect(overlay.children).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(800);
    await done;
    r.dispose();
  });

  it('disposing mid-ignite leaves no nodes, timers or registry entry', async () => {
    const overlay = new FakeEl();
    const { r } = make(overlay, props({ autoExtinguishMs: 5000 }), 'high');
    const done = r.trigger!();
    r.dispose();
    await done;
    expect(overlay.children).toHaveLength(0);
    expect(hasActiveFlame()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(head.children).toHaveLength(0);
  });
});
