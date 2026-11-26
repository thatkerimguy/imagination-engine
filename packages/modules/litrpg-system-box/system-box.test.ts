// Schema, card, and renderer lifecycle under a minimal fake DOM (node env).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RendererContext } from '@kn/core/renderer';
import { formatCardSummary, schema, type SystemBoxProps } from './index.ts';
import createRenderer from './renderer.ts';

const defaults = schema.defaults;

describe('schema', () => {
  it('validates defaults and meta', () => {
    expect(schema.validate({}).ok).toBe(true);
    expect(schema.meta.id).toBe('litrpg-system-box');
    expect(schema.meta.layer).toBe('inline');
    expect(defaults.variant).toBe('level-up');
  });
  it('rejects bad props', () => {
    expect(schema.validate({ title: '  ' }).ok).toBe(false);
    expect(schema.validate({ lines: ['ok', ' '] }).ok).toBe(false);
    expect(schema.validate({ lines: [] }).ok).toBe(false);
    expect(schema.validate({ lines: Array.from({ length: 9 }, () => 'x') }).ok).toBe(false);
    expect(schema.validate({ header: 'x'.repeat(61) }).ok).toBe(false);
    expect(schema.validate({ variant: 'neon' }).ok).toBe(false);
  });
});

describe('card', () => {
  it('summarises', () => {
    const c = formatCardSummary(defaults);
    expect(c.title).toBe('📟 Class Evolution Unlocked');
    expect(c.subtitle).toBe('3 lines · [SYSTEM NOTIFICATION]');
    expect(c.badge).toBe('LEVEL-UP');
  });
});

class FakeEl {
  textContent = '';
  className = '';
  dataset: Record<string, string> = {};
  attrs: Record<string, string> = {};
  attached = false;
  readonly children: FakeEl[] = [];
  append(...nodes: (FakeEl | string)[]): void {
    for (const n of nodes) {
      if (typeof n === 'string') this.textContent += n;
      else {
        n.attached = true;
        this.children.push(n);
      }
    }
  }
  setAttribute(k: string, v: string): void {
    this.attrs[k] = v;
  }
  remove(): void {
    this.attached = false;
  }
}

const g = globalThis as unknown as Record<string, unknown>;
let styleEls: FakeEl[];

beforeEach(() => {
  styleEls = [];
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
  delete g.document;
});

const makeCtx = (host: FakeEl, ac: AbortController, tier: 'high' | 'lite' | 'reduced') =>
  ({
    props: { ...defaults } as SystemBoxProps,
    tier,
    host,
    signal: ac.signal,
    audio: { context: null, sfx: null },
  }) as unknown as RendererContext<SystemBoxProps>;

describe('renderer', () => {
  it('renders title and lines with tier/variant attributes', async () => {
    const host = new FakeEl();
    const r = createRenderer();
    await r.mount(makeCtx(host, new AbortController(), 'high'));
    const box = host.children[0]!;
    expect(box.dataset.knVariant).toBe('level-up');
    expect(box.dataset.knTier).toBe('high');
    expect(box.attrs.role).toBe('group');
    expect(box.children[0]!.children[0]!.textContent).toBe('Class Evolution Unlocked');
    expect(box.children[1]!.children).toHaveLength(3);
    r.dispose();
  });
  it('reducedMotionFallback is static and trigger resolves at once', async () => {
    const host = new FakeEl();
    const r = createRenderer();
    await r.reducedMotionFallback(makeCtx(host, new AbortController(), 'high'));
    expect(host.children[0]!.dataset.knTier).toBe('reduced');
    await r.trigger?.();
    r.dispose();
  });
  it('leaves no DOM or style nodes after ×20 mount/dispose', async () => {
    const host = new FakeEl();
    for (let i = 0; i < 20; i++) {
      const r = createRenderer();
      const ac = new AbortController();
      await r.mount(makeCtx(host, ac, 'lite'));
      const pending = r.trigger?.();
      if (i % 2 === 0) ac.abort();
      else r.dispose();
      await pending;
      r.dispose();
    }
    expect(host.children.every((c) => !c.attached)).toBe(true);
    expect(styleEls).toHaveLength(20);
    expect(styleEls.every((s) => !s.attached)).toBe(true);
  });
});
