import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { schema } from './schema.ts';
import { formatCardSummary } from './card.ts';
import {
  angleDelta,
  initialReveal,
  initialTilt,
  isRevealed,
  rebaseline,
  reduceReveal,
  stepTilt,
} from './whisper-state.ts';
import createRenderer from './renderer.ts';

const d = schema.defaults;

describe('schema', () => {
  it('accepts defaults', () => {
    expect(schema.validate(d).ok).toBe(true);
  });
  it('has the tilt field gated on revealMode with 10..40 range', () => {
    const f = schema.fields.find((x) => x.key === 'tiltThresholdDeg');
    expect(f).toMatchObject({ type: 'number', min: 10, max: 40, step: 1, unit: '°' });
    expect(f?.showWhen).toEqual({ field: 'revealMode', equals: 'hold-or-tilt' });
  });
  it('rejects out-of-range tilt, long and blank lines', () => {
    expect(schema.validate({ ...d, tiltThresholdDeg: 5 }).ok).toBe(false);
    expect(schema.validate({ ...d, tiltThresholdDeg: 41 }).ok).toBe(false);
    expect(schema.validate({ ...d, ghostLine: 'x'.repeat(201) }).ok).toBe(false);
    expect(schema.validate({ ...d, surfaceLine: '   ' }).ok).toBe(false);
    expect(schema.validate({ ...d, ghostLine: '' }).ok).toBe(false);
  });
});

describe('card', () => {
  it('summarises and truncates', () => {
    const c = formatCardSummary({ ...d, ghostLine: 'g'.repeat(60) });
    expect(c.title).toBe('👻 Ghost line · Cyan');
    expect(c.badge).toBe('HOLD/TILT');
    expect(c.subtitle).toContain('“Routine telemetry check. Al…”');
    expect(c.subtitle).toContain(`“${'g'.repeat(27)}…”`);
  });
  it('shows HOLD for hold-only', () => {
    expect(formatCardSummary({ ...d, revealMode: 'hold-only', accent: 'amber' })).toMatchObject({
      badge: 'HOLD',
      title: '👻 Ghost line · Amber',
    });
  });
});

describe('tilt hysteresis', () => {
  it('uses the first reading as baseline', () => {
    const s = stepTilt(initialTilt(), 40, 5, 18);
    expect(s).toMatchObject({ baseBeta: 40, baseGamma: 5, active: false });
  });
  it('enters at threshold and exits at 65% of it', () => {
    // Readings are [beta, gamma]; the first one is the baseline.
    const walk = (...betas: number[]): boolean[] => {
      let s = stepTilt(initialTilt(), 0, 0, 20);
      return betas.map((b) => (s = stepTilt(s, b, 0, 20)).active);
    };
    expect(walk(19, 20, 14, 13)).toEqual([false, true, true, false]);
  });
  it('takes the larger of beta/gamma deltas', () => {
    expect(stepTilt(stepTilt(initialTilt(), 0, 0, 20), 5, -25, 20).active).toBe(true);
  });
  it('handles angle wrap', () => {
    expect(angleDelta(359, 1)).toBe(2);
    expect(angleDelta(-170, 170)).toBe(20);
    let s = stepTilt(initialTilt(), 0, 179, 18);
    s = stepTilt(s, 0, -179, 18);
    expect(s.active).toBe(false);
  });
  it('rebaselines on demand and ignores non-finite readings', () => {
    let s = stepTilt(initialTilt(), 0, 0, 10);
    s = stepTilt(s, 30, 0, 10);
    expect(s.active).toBe(true);
    expect(stepTilt(s, Number.NaN, 0, 10)).toBe(s);
    s = stepTilt(rebaseline(), 30, 0, 10);
    expect(s).toMatchObject({ baseBeta: 30, active: false });
  });
});

describe('reveal reducer', () => {
  it('combines hold, tilt and toggle', () => {
    type Ev = Parameters<typeof reduceReveal>[1];
    let s = initialReveal();
    const seen = [isRevealed(s)];
    const evs: Ev[] = [
      { type: 'hold', on: true },
      { type: 'tilt', on: true },
      { type: 'hold', on: false },
      { type: 'tilt', on: false },
      { type: 'toggle' },
      { type: 'toggle' },
    ];
    for (const e of evs) seen.push(isRevealed((s = reduceReveal(s, e))));
    expect(seen).toEqual([false, true, true, true, false, true, false]);
  });
});

class FakeEl extends EventTarget {
  textContent = '';
  className = '';
  tabIndex = -1;
  removed = false;
  readonly dataset: Record<string, string> = {};
  readonly attrs: Record<string, string> = {};
  readonly children: FakeEl[] = [];
  append(...n: FakeEl[]): void {
    this.children.push(...n);
  }
  setAttribute(k: string, v: string): void {
    this.attrs[k] = v;
  }
  remove(): void {
    this.removed = true;
  }
}

type G = { window?: unknown; document?: unknown };
const g = globalThis as unknown as G;
type Cb = EventListenerOrEventListenerObject | null;
class SpyWin extends EventTarget {
  DeviceOrientationEvent: unknown = {};
  setTimeout = globalThis.setTimeout.bind(globalThis);
  override addEventListener(t: string, cb: Cb, o?: AddEventListenerOptions | boolean): void {
    winAdds.push(t);
    super.addEventListener(t, cb, o);
  }
  override removeEventListener(t: string, cb: Cb, o?: EventListenerOptions | boolean): void {
    winRemoves.push(t);
    super.removeEventListener(t, cb, o);
  }
}
let head: FakeEl;
let win: SpyWin;
let winAdds: string[];
let winRemoves: string[];

beforeEach(() => {
  head = new FakeEl();
  winAdds = [];
  winRemoves = [];
  win = new SpyWin();
  g.window = win;
  g.document = {
    head,
    createElement: () => new FakeEl(),
  };
});
afterEach(() => {
  delete g.window;
  delete g.document;
});

function ctxFor(tier: 'high' | 'lite' | 'reduced', props = d) {
  const host = new FakeEl();
  const ac = new AbortController();
  const ctx = {
    props,
    tier,
    blockId: 'b',
    host: host as unknown as HTMLElement,
    stage: {} as never,
    audio: { context: null, sfx: null } as never,
    signal: ac.signal,
    resolveAsset: (x: string) => x,
  };
  return { ctx, host, ac };
}

describe('renderer', () => {
  it('renders text only, reveals on hold and tilt, and cleans up on dispose', async () => {
    const r = createRenderer();
    const { ctx, host } = ctxFor('high');
    await r.mount(ctx);
    const root = host.children[0]!;
    expect(root.attrs['role']).toBe('button');
    expect(root.dataset['knRevealed']).toBe('false');
    expect(root.children.map((c) => c.textContent)).toEqual([d.surfaceLine, d.ghostLine]);
    expect(winAdds).toContain('deviceorientation');
    root.dispatchEvent(new Event('pointerdown'));
    expect(root.dataset['knRevealed']).toBe('true');
    root.dispatchEvent(new Event('pointerleave'));
    expect(root.dataset['knRevealed']).toBe('false');
    const tiltEv = (beta: number) =>
      Object.assign(new Event('deviceorientation'), { beta, gamma: 0 });
    win.dispatchEvent(tiltEv(0));
    win.dispatchEvent(tiltEv(30));
    expect(root.dataset['knRevealed']).toBe('true');
    r.dispose();
    expect(root.removed).toBe(true);
    expect(head.children[0]!.removed).toBe(true);
    expect(winRemoves).toContain('deviceorientation');
    win.dispatchEvent(tiltEv(0));
    root.dispatchEvent(new Event('pointerdown'));
    expect(root.dataset['knRevealed']).toBe('true');
  });

  it('skips tilt when permission is required or hold-only', async () => {
    win.DeviceOrientationEvent = {
      requestPermission: () => Promise.resolve('granted'),
    };
    const a = createRenderer();
    await a.mount(ctxFor('high').ctx);
    expect(winAdds).not.toContain('deviceorientation');
    a.dispose();
    win.DeviceOrientationEvent = {};
    const b = createRenderer();
    await b.mount(ctxFor('high', { ...d, revealMode: 'hold-only' }).ctx);
    expect(winAdds).not.toContain('deviceorientation');
    b.dispose();
  });

  it('reduced tier toggles on click and supports keyboard', async () => {
    const r = createRenderer();
    const { ctx, host } = ctxFor('reduced');
    await r.reducedMotionFallback(ctx);
    const root = host.children[0]!;
    expect(winAdds).not.toContain('deviceorientation');
    root.dispatchEvent(new Event('pointerdown'));
    expect(root.dataset['knRevealed']).toBe('false');
    root.dispatchEvent(new Event('click'));
    expect(root.dataset['knRevealed']).toBe('true');
    root.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Enter' }));
    expect(root.dataset['knRevealed']).toBe('false');
    r.dispose();
  });

  it('disposes when the host signal aborts and keeps styles ref-counted', async () => {
    const a = createRenderer();
    const b = createRenderer();
    const ca = ctxFor('lite');
    await a.mount(ca.ctx);
    await b.mount(ctxFor('lite').ctx);
    expect(head.children).toHaveLength(1);
    a.dispose();
    b.dispose();
    expect(head.children[0]!.removed).toBe(true);
    const r = createRenderer();
    const c = ctxFor('high');
    await r.mount(c.ctx);
    const root = c.host.children[0]!;
    c.ac.abort();
    root.dispatchEvent(new Event('pointerdown'));
    expect(root.dataset['knRevealed']).toBe('false');
    r.dispose();
  });
});
