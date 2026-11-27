// @vitest-environment happy-dom
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBlueprintProps, type GimmickEngine } from '@kn/core/gimmicks';
import { validateBlueprint } from '@kn/core/gimmicks/validate';
import { describe, expect, it } from 'vitest';
import { BATCH_B } from './blueprints/batch-b.ts';
import { btnOf, EVIL, key, live, ptr, setup } from './batch-b-setup.ts';
import kineticProse from './kinetic-prose/index.ts';
import { createTestContext } from './shared/test-context.ts';
import tactileReveal from './tactile-reveal/index.ts';
import telemetryMeter from './telemetry-meter/index.ts';

describe('blueprints', () => {
  it('has the six starters in order and all validate', () => {
    expect(BATCH_B.map((b) => b.id)).toEqual([
      'wax-seal-letter',
      'biometric-lock',
      'ekg-vitals',
      'sanity-gauge',
      'typewriter-echo',
      'whisper-shiver',
    ]);
    for (const b of BATCH_B) {
      const r = validateBlueprint(b);
      expect(r.ok ? [] : r.errors).toEqual([]);
    }
  });

  it('mounts defaultProps and sampleProps for every engine without throwing', () => {
    const engines: Record<string, GimmickEngine> = {
      'tactile-reveal': tactileReveal,
      'telemetry-meter': telemetryMeter,
      'kinetic-prose': kineticProse,
    };
    for (const b of BATCH_B) {
      for (const raw of [b.defaultProps, b.sampleProps]) {
        const r = resolveBlueprintProps(b, raw);
        expect(r.ok).toBe(true);
        if (!r.ok) continue;
        for (const tier of ['high', 'lite', 'reduced'] as const) {
          const t = createTestContext(tier);
          live.push(t);
          const host = document.createElement('div');
          const inst = engines[b.engine]!.mount(host, b, r.props, t.ctx);
          expect(host.firstElementChild?.getAttribute('data-engine')).toBe(b.engine);
          inst.destroy();
        }
      }
    }
  });

  it('engine sources never use innerHTML', () => {
    for (const dir of ['tactile-reveal', 'telemetry-meter', 'kinetic-prose']) {
      const base = join(dirname(fileURLToPath(import.meta.url)), dir);
      for (const f of readdirSync(base)) {
        expect(readFileSync(join(base, f), 'utf8')).not.toMatch(
          /innerHTML|outerHTML|insertAdjacentHTML|document\.write/,
        );
      }
    }
  });
});

describe('tactile-reveal', () => {
  it('renders closed with aria-expanded=false and a labelled region', () => {
    const { root } = setup(tactileReveal, 'wax-seal-letter', 'high');
    const b = btnOf(root);
    expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(b.getAttribute('aria-label')).toBe('Break the seal');
    const region = root.querySelector<HTMLElement>(`#${b.getAttribute('aria-controls')}`)!;
    expect(region.hidden).toBe(true);
    expect(root.dataset.state).toBe('idle');
  });

  it('reveals on a single click in lite', () => {
    const { root, t } = setup(tactileReveal, 'wax-seal-letter', 'lite');
    btnOf(root).click();
    expect(btnOf(root).getAttribute('aria-expanded')).toBe('true');
    expect(root.dataset.state).toBe('done');
    expect(t.stingers).toEqual(['seal-crack']);
  });

  it('Enter reveals instantly in high, cracking with sound and a heavy haptic', () => {
    const { root, t } = setup(tactileReveal, 'wax-seal-letter', 'high');
    key(btnOf(root), 'keydown', 'Enter');
    expect(btnOf(root).getAttribute('aria-expanded')).toBe('true');
    expect(root.classList.contains('is-open')).toBe(true);
    expect(t.stingers).toEqual(['seal-crack']);
    expect(t.haptics).toContain('heavy');
  });

  it('biometric Space hold fills over 650 ms; releasing early resets', () => {
    const { root, t } = setup(tactileReveal, 'biometric-lock', 'high');
    const b = btnOf(root);
    key(b, 'keydown', ' ');
    t.advance(300);
    key(b, 'keyup', ' ');
    t.advance(1000);
    expect(b.getAttribute('aria-expanded')).toBe('false');
    expect(root.classList.contains('is-holding')).toBe(false);
    key(b, 'keydown', ' ');
    t.advance(649);
    expect(b.getAttribute('aria-expanded')).toBe('false');
    t.advance(2);
    expect(b.getAttribute('aria-expanded')).toBe('true');
    expect(t.haptics).toContain('tap');
    expect(t.stingers).toEqual(['beep']);
  });

  it('biometric pointer hold reveals; an early pointerup does not', () => {
    const { root, t } = setup(tactileReveal, 'biometric-lock', 'high');
    const b = btnOf(root);
    ptr(b, 'pointerdown');
    t.advance(200);
    ptr(b, 'pointerup');
    t.advance(1000);
    expect(b.getAttribute('aria-expanded')).toBe('false');
    ptr(b, 'pointerdown');
    t.advance(700);
    expect(b.getAttribute('aria-expanded')).toBe('true');
  });

  it('scratch-off reveals once >= 35% of the grid is swept', () => {
    const { root } = setup(tactileReveal, 'wax-seal-letter', 'high', { mechanism: 'scratch-off' });
    const b = btnOf(root);
    ptr(b, 'pointerdown', 5, 10);
    for (let x = 0; x < 360; x += 20) ptr(b, 'pointermove', x, 10);
    for (let x = 0; x < 100; x += 20) ptr(b, 'pointermove', x, 50);
    expect(b.getAttribute('aria-expanded')).toBe('false');
    for (let x = 0; x < 360; x += 20) ptr(b, 'pointermove', x, 90);
    expect(b.getAttribute('aria-expanded')).toBe('true');
  });

  it('fog-wipe has a click fallback', () => {
    const { root } = setup(tactileReveal, 'wax-seal-letter', 'high', { mechanism: 'fog-wipe' });
    btnOf(root).click();
    expect(btnOf(root).getAttribute('aria-expanded')).toBe('true');
  });

  it('trigger plays a short cue, resolves, and does not reveal', async () => {
    const { root, t, inst } = setup(tactileReveal, 'wax-seal-letter', 'high');
    const p = inst.trigger();
    expect(root.dataset.state).toBe('ready');
    t.advance(601);
    await p;
    expect(btnOf(root).getAttribute('aria-expanded')).toBe('false');
    expect(t.pending()).toBe(0);
  });

  it('live downgrade to reduced reveals instantly and resolves a pending trigger', async () => {
    const { root, t, inst } = setup(tactileReveal, 'wax-seal-letter', 'high');
    const p = inst.trigger();
    t.setTier('reduced');
    await p;
    expect(btnOf(root).getAttribute('aria-expanded')).toBe('true');
    expect(root.dataset.state).toBe('done');
    expect(t.stingers).toEqual([]);
    expect(t.pending()).toBe(0);
  });

  it('reduced and calm mount revealed with no sound or haptics', async () => {
    for (const calm of [false, true]) {
      const { root, t, inst } = setup(tactileReveal, 'wax-seal-letter', 'reduced', {}, calm);
      expect(btnOf(root).getAttribute('aria-expanded')).toBe('true');
      await inst.trigger();
      btnOf(root).click();
      expect([t.stingers, t.haptics]).toEqual([[], []]);
    }
  });

  it('renders author text as text, never markup', () => {
    const { root } = setup(tactileReveal, 'wax-seal-letter', 'lite', {
      prompt: EVIL,
      label: EVIL,
      revealedTitle: EVIL,
      revealedBody: [EVIL],
    });
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain(EVIL);
  });

  it('destroy is idempotent and leaves nothing pending', () => {
    const { root, t, inst } = setup(tactileReveal, 'biometric-lock', 'high');
    key(btnOf(root), 'keydown', ' ');
    void inst.trigger();
    inst.destroy();
    inst.destroy();
    expect(document.body.contains(root)).toBe(false);
    expect(t.pending()).toBe(0);
  });
});
