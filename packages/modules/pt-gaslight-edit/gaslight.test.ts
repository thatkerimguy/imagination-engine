// Schema, card, state machine, and renderer cleanup under a minimal fake DOM (node env).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RendererContext } from '@kn/core/renderer';
import { formatCardSummary, schema, type GaslightProps } from './index.ts';
import createRenderer from './renderer.ts';
import { initialState, step, type GaslightState, type StepInput } from './state.ts';

const defaults = schema.defaults;

describe('schema', () => {
  it('validates defaults', () => {
    expect(schema.validate({}).ok).toBe(true);
    expect(schema.meta.genre).toBe('psych-thriller');
    expect(schema.meta.layer).toBe('inline');
  });
  it('rejects bad props', () => {
    expect(schema.validate({ initialText: '   ' }).ok).toBe(false);
    expect(schema.validate({ mutatedText: '' }).ok).toBe(false);
    expect(schema.validate({ mutatedText: defaults.initialText }).ok).toBe(false);
    expect(schema.validate({ triggerDistancePx: 70 }).ok).toBe(false);
    expect(schema.validate({ triggerDistancePx: 1000 }).ok).toBe(false);
    expect(schema.validate({ initialText: 'x'.repeat(601) }).ok).toBe(false);
    expect(schema.validate({ tone: 'neon' }).ok).toBe(false);
  });
});

describe('card', () => {
  it('summarises and truncates', () => {
    const c = formatCardSummary({ ...defaults, initialText: 'a'.repeat(40), mutatedText: 'b' });
    expect(c.title).toBe('🕯️ Gaslight · after 220px');
    expect(c.subtitle).toBe(`“${'a'.repeat(27)}…” → “b”`);
    expect(c.badge).toBe('ONCE');
    expect(formatCardSummary({ ...defaults, once: false }).badge).toBe('LOOPS');
  });
});

const T = { triggerDistancePx: 220, once: true };
const at = (bottom: number, scrollingUp: boolean, top = bottom - 100): StepInput => ({
  top,
  bottom,
  viewportH: 800,
  scrollingUp,
});
const run = (s: GaslightState, inputs: StepInput[], p = T): GaslightState =>
  inputs.reduce((acc, i) => step(acc, i, p), s);

describe('state machine', () => {
  it('does not mutate on initial view or while reading forward', () => {
    const s = run(initialState(), [
      at(400, false),
      at(100, false),
      at(-100, false),
      at(-200, false),
    ]);
    expect(s).toEqual(initialState());
  });
  it('arms past the trigger distance', () => {
    expect(run(initialState(), [at(-221, false)]).phase).toBe('armed');
  });
  it('mutates on scroll-up while still out of view', () => {
    const s = run(initialState(), [at(-300, false), at(-250, true)]);
    expect(s).toEqual({ phase: 'mutated', showing: 'mutated' });
  });
  it('stays armed while scrolling further down', () => {
    const s = run(initialState(), [at(-300, false), at(-500, false)]);
    expect(s).toEqual({ phase: 'armed', showing: 'initial' });
  });
  it('falls back to swapping on re-entry', () => {
    const s = run(initialState(), [at(-300, false), at(50, false, -50)]);
    expect(s.showing).toBe('mutated');
  });
  it('once:true stays mutated across later passes', () => {
    const s = run(initialState(), [
      at(-300, false),
      at(-250, true),
      at(-400, false),
      at(-100, true),
    ]);
    expect(s).toEqual({ phase: 'mutated', showing: 'mutated' });
  });
  it('once:false alternates', () => {
    const p = { ...T, once: false };
    let s = run(initialState(), [at(-300, false), at(-250, true)], p);
    expect(s.showing).toBe('mutated');
    s = run(s, [at(-300, false)], p);
    expect(s).toEqual({ phase: 'armed', showing: 'mutated' });
    s = run(s, [at(-100, true)], p);
    expect(s).toEqual({ phase: 'initial', showing: 'initial' });
    s = run(s, [at(-300, false), at(-100, true)], p);
    expect(s.showing).toBe('mutated');
  });
});

class FakeEl extends EventTarget {
  textContent = '';
  className = '';
  dataset: Record<string, string> = {};
  attrs: Record<string, string> = {};
  removed = false;
  rect = { top: 0, bottom: 100 };
  readonly children: FakeEl[] = [];
  append(...nodes: FakeEl[]): void {
    this.children.push(...nodes);
  }
  setAttribute(k: string, v: string): void {
    this.attrs[k] = v;
  }
  remove(): void {
    this.removed = true;
  }
  getBoundingClientRect(): { top: number; bottom: number } {
    return this.rect;
  }
}

class FakeObserver {
  static live = 0;
  disconnected = false;
  constructor(readonly cb: () => void) {
    FakeObserver.live++;
  }
  observe(): void {}
  disconnect(): void {
    if (!this.disconnected) FakeObserver.live--;
    this.disconnected = true;
  }
}

type FakeWin = EventTarget & {
  scrollY: number;
  innerHeight: number;
  requestAnimationFrame(cb: () => void): number;
  cancelAnimationFrame(id: number): void;
};
const g = globalThis as unknown as Record<string, unknown>;
let win: FakeWin;
let frames: Map<number, () => void>;
let styleEls: FakeEl[];
let nextId = 1;
let listenerCount = 0;

beforeEach(() => {
  frames = new Map();
  styleEls = [];
  listenerCount = 0;
  FakeObserver.live = 0;
  const w = new EventTarget() as FakeWin;
  const add = w.addEventListener.bind(w);
  w.addEventListener = ((...a: Parameters<typeof add>) => {
    listenerCount++;
    add(...a);
    const signal = (a[2] as AddEventListenerOptions | undefined)?.signal;
    signal?.addEventListener('abort', () => listenerCount--);
  }) as typeof w.addEventListener;
  w.scrollY = 0;
  w.innerHeight = 800;
  w.requestAnimationFrame = (cb) => {
    frames.set(nextId, cb);
    return nextId++;
  };
  w.cancelAnimationFrame = (id) => void frames.delete(id);
  win = w;
  g.window = w;
  g.IntersectionObserver = FakeObserver;
  g.document = {
    createElement: (tag: string) => {
      const e = new FakeEl();
      if (tag === 'style') styleEls.push(e);
      return e;
    },
    head: new FakeEl(),
  };
});

afterEach(() => {
  delete g.window;
  delete g.document;
  delete g.IntersectionObserver;
});

const flushFrames = (): void => {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((f) => f());
};

const makeCtx = (host: FakeEl, ac: AbortController, p: Partial<GaslightProps> = {}) =>
  ({
    props: { ...defaults, ...p },
    tier: 'high',
    host,
    signal: ac.signal,
  }) as unknown as RendererContext<GaslightProps>;

describe('renderer', () => {
  it('renders both texts, swaps silently, and cleans up on dispose', async () => {
    const host = new FakeEl();
    const ac = new AbortController();
    const r = createRenderer();
    await r.mount(makeCtx(host, ac));
    const root = host.children[0]!;
    const [a, b] = root.children as [FakeEl, FakeEl];
    expect(a.textContent).toBe(defaults.initialText);
    expect(b.textContent).toBe(defaults.mutatedText);
    expect(root.dataset.knState).toBe('initial');
    expect(a.attrs['aria-hidden']).toBe('false');
    expect(b.attrs['aria-hidden']).toBe('true');

    win.scrollY = 600;
    root.rect = { top: -500, bottom: -400 };
    win.dispatchEvent(new Event('scroll'));
    flushFrames();
    expect(root.dataset.knState).toBe('armed');
    win.scrollY = 560;
    win.dispatchEvent(new Event('scroll'));
    flushFrames();
    expect(root.dataset.knState).toBe('mutated');
    expect(a.attrs['aria-hidden']).toBe('true');
    expect(b.attrs['aria-hidden']).toBe('false');

    await expect(r.trigger?.()).resolves.toBeUndefined();
    expect(listenerCount).toBe(1);
    expect(FakeObserver.live).toBe(1);
    expect(styleEls[0]!.removed).toBe(false);
    win.dispatchEvent(new Event('scroll'));
    expect(frames.size).toBe(1);
    r.dispose();
    expect(frames.size).toBe(0);
    expect(listenerCount).toBe(0);
    expect(FakeObserver.live).toBe(0);
    expect(root.removed).toBe(true);
    expect(styleEls[0]!.removed).toBe(true);
  });

  it('cleans up when the context signal aborts', async () => {
    const host = new FakeEl();
    const ac = new AbortController();
    const r = createRenderer();
    await r.reducedMotionFallback(makeCtx(host, ac, { tone: 'ink-bruise' }));
    expect(host.children[0]!.className).toContain('kn-gl--bruise');
    win.dispatchEvent(new Event('scroll'));
    ac.abort();
    expect(frames.size).toBe(0);
    expect(listenerCount).toBe(0);
    expect(FakeObserver.live).toBe(0);
    expect(host.children[0]!.removed).toBe(true);
    expect(styleEls[0]!.removed).toBe(true);
  });
});
