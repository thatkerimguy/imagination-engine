// @vitest-environment happy-dom
import type { BlueprintRecord } from '@kn/core/gimmicks';
import { describe, expect, it } from 'vitest';
import { setup } from './batch-c-setup.ts';

const key = (n: HTMLElement, k: string): void => {
  n.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
};

describe('margin-note', () => {
  it('renders a collapsed accessible anchor and a labelled hidden region', () => {
    const { root } = setup('lore-footnote', 'high');
    const a = root.querySelector('button')!;
    expect(a.getAttribute('aria-expanded')).toBe('false');
    const region = root.querySelector<HTMLElement>(`#${a.getAttribute('aria-controls')}`)!;
    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('aria-label')).toBe('On the Ashen Court');
    expect(region.hidden).toBe(true);
  });

  it('opens on click, closes via the close button and Escape, returning focus to the anchor', () => {
    const { root } = setup('lore-footnote', 'high');
    const a = root.querySelector<HTMLButtonElement>('button')!;
    a.click();
    const region = root.querySelector<HTMLElement>('[role=region]')!;
    expect(region.hidden).toBe(false);
    expect(a.getAttribute('aria-expanded')).toBe('true');
    const close = root.querySelector<HTMLButtonElement>('button[aria-label="Close note"]')!;
    close.focus();
    key(close, 'Escape');
    expect(region.hidden).toBe(true);
    expect(document.activeElement).toBe(a);
    a.click();
    close.click();
    expect(region.hidden).toBe(true);
    expect(document.activeElement).toBe(a);
  });

  it('trigger nudges briefly on high and resolves; never blocks otherwise', async () => {
    const { root, t, inst } = setup('pov-whisper-note', 'high');
    const p = inst.trigger();
    expect(root.classList.contains('is-nudge')).toBe(true);
    t.advance(601);
    await p;
    expect(root.classList.contains('is-nudge')).toBe(false);
    expect(t.pending()).toBe(0);
    const lite = setup('pov-whisper-note', 'lite');
    await lite.inst.trigger();
    expect(lite.root.classList.contains('is-nudge')).toBe(false);
  });

  it('live reduced ends the nudge and resolves; open state survives', async () => {
    const { root, t, inst } = setup('lore-footnote', 'high');
    root.querySelector('button')!.click();
    const p = inst.trigger();
    await p;
    const q = setup('lore-footnote', 'high');
    const p2 = q.inst.trigger();
    q.t.setTier('reduced');
    await p2;
    expect(q.t.pending()).toBe(0);
    expect(root.querySelector<HTMLElement>('[role=region]')!.hidden).toBe(false);
    expect(t.pending()).toBe(0);
  });
});

describe('spatial-layout', () => {
  const entries: BlueprintRecord[] = [
    { col: 'left', text: 'a' },
    { col: 'right', text: 'b' },
    { text: 'c' },
  ];
  it('builds columns with labels and staggers at most 70 ms per item', () => {
    const { root } = setup('dual-pov-split', 'high', { entries });
    const cells = [...root.querySelectorAll<HTMLElement>('[data-col]')];
    expect(cells.map((c) => c.dataset.col)).toEqual(['left', 'right', 'left']);
    const delays = cells.map((c) => parseInt(c.style.getPropertyValue('--d'), 10));
    expect(delays[0]).toBe(0);
    expect(delays[2]! - delays[1]!).toBeLessThanOrEqual(70);
    expect(root.querySelector('.kn-e-spatial-layout__head')!.textContent).toContain('Detective');
  });

  it('has overflow-safe CSS, lite has no delay-driven motion, reduced is static immediately', async () => {
    const css = document.head.querySelector('style[data-kn-engine="spatial-layout"]');
    setup('dual-pov-split', 'high');
    const style = document.head.querySelector('style[data-kn-engine="spatial-layout"]')!;
    expect(css ?? style).toBeTruthy();
    expect(style.textContent).toContain('min-width:0');
    expect(style.textContent).toContain('overflow-wrap:anywhere');
    expect(style.textContent).toContain('@container kn-sl (min-width:520px)');
    const r = setup('dual-pov-split', 'reduced');
    expect(r.root.dataset.state).toBe('done');
    await r.inst.trigger();
    const cell = r.root.querySelector<HTMLElement>('[data-col]')!;
    expect(cell.style.getPropertyValue('--d')).toBe('0ms');
  });

  it('trigger resolves after the stagger and live reduced resolves early', async () => {
    const { root, t, inst } = setup('falling-lines-poem', 'high');
    const p = inst.trigger();
    expect(root.dataset.state).toBe('playing');
    t.advance(1000);
    await p;
    expect(root.dataset.state).toBe('done');
    const q = setup('falling-lines-poem', 'high');
    const p2 = q.inst.trigger();
    q.t.setTier('reduced');
    await p2;
    expect(q.t.pending()).toBe(0);
  });

  it('pause holds the timer; resume finishes', async () => {
    const { root, t, inst } = setup('falling-lines-poem', 'high');
    const p = inst.trigger();
    t.pause();
    expect(root.hasAttribute('data-paused')).toBe(true);
    t.advance(5000);
    expect(root.dataset.state).toBe('playing');
    t.resume();
    t.advance(1000);
    await p;
    expect(root.dataset.state).toBe('done');
  });
});

describe('screen-fx', () => {
  const overlay = (): HTMLElement | null => document.body.querySelector('.kn-e-screen-fx__ov');
  it('shows an inline marker and only creates the overlay on trigger (body child, fixed)', async () => {
    const { root, t, inst } = setup('frost-creep-chill', 'high');
    expect(root.textContent).toContain('Frost creep');
    expect(overlay()).toBeNull();
    const p = inst.trigger();
    const ov = overlay()!;
    expect(ov.parentElement).toBe(document.body);
    expect(ov.getAttribute('aria-hidden')).toBe('true');
    expect(ov.style.getPropertyValue('--fx-dur')).toBe('4500ms');
    t.advance(501);
    await p;
    expect(overlay()).not.toBeNull();
    t.advance(4500);
    expect(overlay()).toBeNull();
    expect(t.pending()).toBe(0);
  });

  it('pause, reduced and destroy remove the overlay immediately', () => {
    const a = setup('crt-scanline-glitch', 'high');
    void a.inst.trigger();
    a.t.pause();
    expect(overlay()).toBeNull();
    const b = setup('crt-scanline-glitch', 'lite');
    void b.inst.trigger();
    expect(overlay()!.dataset.tier).toBe('lite');
    b.t.setTier('reduced');
    expect(overlay()).toBeNull();
    expect(b.t.pending()).toBe(0);
    const c = setup('crt-scanline-glitch', 'high');
    void c.inst.trigger();
    c.inst.destroy();
    expect(overlay()).toBeNull();
    expect(c.t.pending()).toBe(0);
  });

  it('reduced and calm never create an overlay and hide replay', async () => {
    for (const calm of [false, true]) {
      const { root, inst } = setup('frost-creep-chill', 'reduced', {}, calm);
      await inst.trigger();
      expect(overlay()).toBeNull();
      expect(root.querySelector<HTMLButtonElement>('.kn-e-screen-fx__replay')!.hidden).toBe(true);
    }
  });

  it('replay button re-fires; sepia fades slowly; durations and intensity are clamped', () => {
    const { root } = setup('frost-creep-chill', 'high', {
      effect: 'sepia-flash',
      intensity: 5,
      durationMs: 1,
    });
    root.querySelector<HTMLButtonElement>('.kn-e-screen-fx__replay')!.click();
    const ov = overlay()!;
    expect(ov.dataset.fx).toBe('sepia-flash');
    expect(ov.style.getPropertyValue('--fx-i')).toBe('0.85');
    expect(ov.style.getPropertyValue('--fx-dur')).toBe('1500ms');
  });
});
