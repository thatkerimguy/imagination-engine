// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { setup } from './batch-c-setup.ts';

describe('particle-field', () => {
  const stub = (): { clearRect: ReturnType<typeof vi.fn>; fill: ReturnType<typeof vi.fn> } => {
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
    return g;
  };

  it('does not throw without a 2d context and shows the static form', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { root, t, inst } = setup('cherry-blossom-drift', 'high');
    expect(root.dataset.still).toBe('true');
    expect(t.pending()).toBe(0);
    void inst.trigger();
    expect(t.pending()).toBe(0);
    vi.restoreAllMocks();
  });

  it('animates on raf, caps particles, freezes on pause and resumes', () => {
    const g = stub();
    const { root, t } = setup('ember-storm', 'high', { density: 45 });
    expect(root.dataset.still).toBe('false');
    t.frames(3);
    expect(g.fill.mock.calls.length).toBeLessThanOrEqual(45 * 3);
    const n = g.clearRect.mock.calls.length;
    expect(n).toBeGreaterThan(0);
    t.pause();
    expect(t.pending()).toBe(0);
    t.frames(5);
    expect(g.clearRect.mock.calls.length).toBe(n);
    t.resume();
    t.frames(2);
    expect(g.clearRect.mock.calls.length).toBeGreaterThan(n);
    vi.restoreAllMocks();
  });

  it('lite caps at 18 particles; reduced stops raf, clears and shows the hairline', () => {
    const g = stub();
    const lite = setup('ember-storm', 'lite', { density: 45 });
    lite.t.frames(3);
    expect(g.fill.mock.calls.length).toBeGreaterThan(0);
    expect(g.fill.mock.calls.length).toBeLessThanOrEqual(18);
    const { root, t } = setup('ember-storm', 'high');
    t.frames(2);
    const before = g.clearRect.mock.calls.length;
    t.setTier('reduced');
    expect(t.pending()).toBe(0);
    expect(g.clearRect.mock.calls.length).toBe(before + 1);
    expect(root.dataset.still).toBe('true');
    expect(root.querySelector('.kn-e-particle-field__hair')).not.toBeNull();
    t.setTier('high');
    expect(root.dataset.still).toBe('false');
    expect(t.pending()).toBe(1);
    vi.restoreAllMocks();
  });

  it('fullBleed is a fixed body backdrop removed on destroy', () => {
    stub();
    const { inst } = setup('cherry-blossom-drift', 'high', { fullBleed: true });
    const back = document.body.querySelector('.kn-e-particle-field__back');
    expect(back?.parentElement).toBe(document.body);
    inst.destroy();
    expect(document.body.querySelector('.kn-e-particle-field__back')).toBeNull();
    vi.restoreAllMocks();
  });
});
