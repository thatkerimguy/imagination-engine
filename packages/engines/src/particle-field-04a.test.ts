// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setup } from './batch-c-setup.ts';

type IoCb = (entries: { isIntersecting: boolean }[]) => void;
interface FakeIo {
  cb: IoCb;
  opts: IntersectionObserverInit | undefined;
  disconnected: boolean;
}
const ios: FakeIo[] = [];

function stubIo(): void {
  class IO {
    rec: FakeIo;
    constructor(cb: IoCb, opts?: IntersectionObserverInit) {
      this.rec = { cb, opts, disconnected: false };
      ios.push(this.rec);
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {
      this.rec.disconnected = true;
    }
  }
  vi.stubGlobal('IntersectionObserver', IO);
}

function stubCanvas(): { arc: ReturnType<typeof vi.fn>; style: { fillStyle: string } } {
  const g = {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    fill: vi.fn(),
    ellipse: vi.fn(),
    arc: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: '',
    globalAlpha: 1,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    g as unknown as CanvasRenderingContext2D,
  );
  return { arc: g.arc, style: g };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  ios.length = 0;
});

describe('particle-field visibility (04A)', () => {
  it('observes at threshold 0.05, pauses off-screen without duplicate loops, disconnects', () => {
    stubIo();
    stubCanvas();
    const { t, inst } = setup('ember-storm', 'high');
    expect(ios).toHaveLength(1);
    expect(ios[0]!.opts?.threshold).toBe(0.05);
    expect(t.pending()).toBe(1);
    ios[0]!.cb([{ isIntersecting: false }]);
    expect(t.pending()).toBe(0);
    ios[0]!.cb([{ isIntersecting: true }]);
    ios[0]!.cb([{ isIntersecting: true }]);
    expect(t.pending()).toBe(1);
    t.pause();
    ios[0]!.cb([{ isIntersecting: false }]);
    ios[0]!.cb([{ isIntersecting: true }]);
    expect(t.pending()).toBe(0);
    t.resume();
    expect(t.pending()).toBe(1);
    inst.destroy();
    expect(ios[0]!.disconnected).toBe(true);
  });

  it('disconnects when the context signal aborts', () => {
    stubIo();
    stubCanvas();
    const { t } = setup('ember-storm', 'high');
    t.dispose();
    expect(ios[0]!.disconnected).toBe(true);
  });

  it('works when IntersectionObserver is missing', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    stubCanvas();
    const { t } = setup('ember-storm', 'high');
    expect(t.pending()).toBe(1);
  });
});

describe('ember-storm light theme (04A)', () => {
  it('deepens colour and grows the core by 0.5 px live, then restores on dark', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const c = stubCanvas();
    const { t, root } = setup('ember-storm', 'high');
    t.frames(2);
    const darkColor = c.style.fillStyle;
    const darkR = c.arc.mock.calls.at(-1)![2] as number;
    t.setDna('light');
    t.frames(2);
    expect(c.style.fillStyle).not.toBe(darkColor);
    expect(c.style.fillStyle).toBe('#b23a0e');
    expect(c.arc.mock.calls.at(-1)![2] as number).toBeCloseTo(darkR + 0.5, 5);
    t.setDna('dark');
    t.frames(2);
    expect(c.style.fillStyle).toBe(darkColor);
    expect(c.arc.mock.calls.at(-1)![2] as number).toBeCloseTo(darkR, 5);
    expect(root.isConnected).toBe(true);
  });
});
