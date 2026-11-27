// @vitest-environment happy-dom
import { ORNAMENT_GRAMMARS } from '@kn/core/dna';
import { describe, expect, it, vi } from 'vitest';
import { actionButton, el, injectEngineStyle, svgEl } from './dom-safe.ts';
import { cue, mountFrame, variantOf, wait } from './kit.ts';
import { createOrnamentLayer } from './ornaments.ts';
import { surfaceTile } from './surface-tiles.ts';
import { createTestContext } from './test-context.ts';
import type { GimmickBlueprint } from '@kn/core/gimmicks';

const bp = {
  id: 'kit-test',
  engine: 'frame-hud',
  visual: {
    layout: 'system',
    ornament: 'inherit',
    accentRole: 'primary',
    borderStyle: 'hairline',
    motionPreset: 'fade',
  },
  sound: { patch: 'chime' },
  haptics: 'tap',
} as unknown as GimmickBlueprint;

describe('dom-safe', () => {
  it('only ever writes author text as text nodes', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const p = el('p', { class: 'x' }, evil);
    expect(p.textContent).toBe(evil);
    expect(p.querySelector('img')).toBeNull();
  });

  it('refuses event-handler and URL attributes', () => {
    expect(() => el('div', { onclick: 'x()' })).toThrow();
    expect(() => svgEl('a', { href: 'javascript:x' })).toThrow();
    expect(() => el('iframe', { srcdoc: '<b>' })).toThrow();
  });

  it('injects each engine stylesheet once', () => {
    injectEngineStyle('t', '.a{}');
    injectEngineStyle('t', '.b{}');
    expect(document.querySelectorAll('style[data-kn-engine="t"]')).toHaveLength(1);
  });

  it('action buttons are native buttons whose listener dies with the signal', () => {
    const ac = new AbortController();
    const fn = vi.fn();
    const b = actionButton('Reveal', fn, ac.signal);
    b.click();
    ac.abort();
    b.click();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(b.type).toBe('button');
    expect(b.getAttribute('aria-label')).toBe('Reveal');
  });
});

describe('ornaments and tiles', () => {
  it('builds an aria-hidden inset layer for every grammar', () => {
    for (const g of ORNAMENT_GRAMMARS) {
      const layer = createOrnamentLayer(g, 2);
      expect(layer.getAttribute('aria-hidden')).toBe('true');
      expect(layer.style.pointerEvents).toBe('none');
      expect(layer.querySelectorAll('path,line,rect').length).toBeGreaterThan(0);
    }
  });

  it("returns 'none' without Canvas 2D or for clean surfaces", () => {
    expect(surfaceTile('clean', 'dark')).toBe('none');
    expect(surfaceTile('parchment', 'light', 0.6)).toBe('none');
  });
});

describe('kit + test context', () => {
  it('mounts a scoped frame that tracks the live tier', () => {
    const t = createTestContext('high');
    const host = el('div');
    const { root, body } = mountFrame(host, bp, t.ctx);
    expect(root.className).toContain('kn-e-frame-hud--system');
    expect(root.contains(body)).toBe(true);
    t.setTier('reduced');
    expect(root.dataset.tier).toBe('reduced');
  });

  it('holds timers across pause and releases everything on dispose', async () => {
    const t = createTestContext('high');
    let done = false;
    void wait(t.ctx, 100).then(() => (done = true));
    t.advance(50);
    t.pause();
    t.advance(500);
    await Promise.resolve();
    expect(done).toBe(false);
    t.resume();
    t.advance(50);
    await Promise.resolve();
    expect(done).toBe(true);
    t.ctx.raf(() => undefined);
    t.ctx.interval(() => undefined, 10);
    t.dispose();
    expect(t.pending()).toBe(0);
  });

  it('cues sound + haptics only when not still', () => {
    const t = createTestContext('high');
    cue(t.ctx, bp, {});
    cue(t.ctx, bp, { sound: false });
    t.setTier('lite', true);
    cue(t.ctx, bp, {});
    expect(t.stingers).toEqual(['chime']);
    expect(t.haptics).toEqual(['tap']);
  });

  it('picks variants from props, then the layout', () => {
    expect(variantOf(bp, { mode: 'b' }, 'mode', ['a', 'b'] as const)).toBe('b');
    expect(variantOf(bp, {}, 'mode', ['x', 'system'] as const)).toBe('system');
    expect(variantOf(bp, { mode: 'zz' }, 'mode', ['x', 'y'] as const)).toBe('x');
  });
});
