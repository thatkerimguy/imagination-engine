// @vitest-environment happy-dom
// bespoke-3d (happy-dom has no WebGL, so high falls back to the lite tier here; the real WebGL
// path, ×20 context reuse and live Calm Mode teardown on the stage are proven by smoke.mjs).
import { renderBlueprintExport, resolveBlueprintProps } from '@kn/core/gimmicks';
import { validateBlueprint } from '@kn/core/gimmicks/validate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import engine from './bespoke-3d/index.ts';
import { BATCH_D } from './blueprints/batch-d.ts';
import { createTestContext, type TestContext } from './shared/test-context.ts';

const live: TestContext[] = [];
afterEach(() => {
  for (const t of live.splice(0)) t.dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

const bp = (id: string) => BATCH_D.find((b) => b.id === id)!;
function mount(id: string, tier: 'high' | 'lite' | 'reduced', over = {}, calm = false) {
  const t = createTestContext(tier, 'noir-rain', calm);
  live.push(t);
  const host = document.createElement('div');
  document.body.append(host);
  const b = bp(id);
  const inst = engine.mount(host, b, { ...b.defaultProps, ...over }, t.ctx);
  const root = host.firstElementChild as HTMLElement;
  const result = (): string => root.querySelector('.kn-e-bespoke-3d__result')?.textContent ?? '';
  return { t, inst, root, host, result };
}
const flush = async (t: TestContext, ms = 1500): Promise<void> => {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    t.advance(ms / 8);
  }
};

describe('bespoke-3d blueprints', () => {
  it('two valid hero blueprints with rendering export templates', () => {
    expect(BATCH_D.map((b) => b.id)).toEqual(['dice-throw-3d', 'brass-lighter-3d']);
    for (const b of BATCH_D) {
      expect(validateBlueprint(b).ok, b.id).toBe(true);
      for (const p of [b.defaultProps, b.sampleProps]) {
        const r = resolveBlueprintProps(b, p);
        expect(r.ok ? [] : r.errors, b.id).toEqual([]);
        for (const f of ['transcript', 'summary', 'epubXhtml', 'royalRoadHtml'] as const)
          expect(renderBlueprintExport(b, p, f).length, `${b.id} ${f}`).toBeGreaterThan(4);
      }
    }
  });
});

describe('bespoke-3d engine', () => {
  it('reduced / Calm Mode: a serene static badge at once, no motion, no tray', async () => {
    const { inst, root, result } = mount('dice-throw-3d', 'reduced');
    expect(result()).toBe('2× D6 Ivory settle on [1, 1] · Snake eyes');
    expect(root.dataset.state).toBe('done');
    await inst.trigger();
    expect(root.querySelectorAll('.kn-e-bespoke-3d__die')).toHaveLength(0);
    const z = mount('brass-lighter-3d', 'lite', {}, true);
    expect(z.result()).toBe('Brass lighter flame steadies.');
  });

  it('high without WebGL falls back to the lite tumble and lands the scripted faces', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { t, inst, root, result } = mount('dice-throw-3d', 'high');
    const p = inst.trigger();
    for (let i = 0; i < 40 && !result(); i++) await flush(t, 400); // three.js import is slow
    await p;
    expect(root.querySelectorAll('.kn-e-bespoke-3d__die')).toHaveLength(2);
    expect(result()).toContain('[1, 1]');
    inst.destroy();
    expect(t.pending()).toBe(0);
  });

  it('a live drop to reduced mid-tumble stops in place and resolves the beat', async () => {
    const { t, inst, root, result } = mount('dice-throw-3d', 'lite', { values: ['6', '6'] });
    const p = inst.trigger();
    await Promise.resolve();
    expect(result()).toBe('');
    t.setTier('reduced');
    expect(result()).toContain('[6, 6]');
    expect(root.querySelectorAll('.kn-e-bespoke-3d__die')).toHaveLength(0);
    await flush(t);
    await p;
    inst.destroy();
    expect(t.pending()).toBe(0);
  });

  it('tap mode waits for the throw button (also reachable by keyboard)', async () => {
    const { t, inst, root, result } = mount('dice-throw-3d', 'lite', { trigger: 'tap' });
    const p = inst.trigger();
    await flush(t, 400);
    const go = root.querySelector<HTMLButtonElement>('.kn-e-bespoke-3d__go')!;
    expect(go.hidden).toBe(false);
    expect(go.textContent).toBe('Roll the dice');
    expect(result()).toBe('');
    go.click();
    await flush(t);
    await p;
    expect(result()).toContain('Snake eyes');
  });

  it('20× mount → trigger → destroy leaves no nodes and no pending work', async () => {
    for (let i = 0; i < 20; i++) {
      const { t, inst, host } = mount(i % 2 ? 'brass-lighter-3d' : 'dice-throw-3d', 'lite');
      const p = inst.trigger();
      await flush(t, 200);
      inst.destroy();
      await p;
      expect(host.childElementCount).toBe(0);
      expect(t.pending()).toBe(0);
      t.dispose();
    }
    expect(document.querySelectorAll('.kn-stage-gl')).toHaveLength(0);
  });

  it('author text stays text', () => {
    const evil = '<img src=x onerror=alert(1)>';
    const { root } = mount('brass-lighter-3d', 'reduced', { caption: evil, settledText: evil });
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain(evil);
  });
});
