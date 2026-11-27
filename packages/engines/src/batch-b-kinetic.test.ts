// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { bpOf, EVIL, setup } from './batch-b-setup.ts';
import kineticProse from './kinetic-prose/index.ts';

describe('kinetic-prose', () => {
  const type = (root: HTMLElement): number =>
    root.querySelectorAll('.kn-e-kinetic-prose__c.on').length;

  it('exposes the text once: sr-only copy, aria-label, aria-hidden animated layer', () => {
    const { root } = setup(kineticProse, 'typewriter-echo', 'high');
    const text = bpOf('typewriter-echo').defaultProps.text as string;
    expect(root.getAttribute('aria-label')).toBe(text);
    expect(root.querySelector('.kn-e-sr')!.textContent).toBe(text);
    expect(root.querySelector('.kn-e-kinetic-prose__layer')!.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(root.dataset.layout).toBe('typewriter');
  });

  it('typewriter types in on high and lands within the 2.4 s cap', async () => {
    const long = 'a quiet word '.repeat(40);
    const { root, t, inst } = setup(kineticProse, 'typewriter-echo', 'high', { text: long });
    expect(type(root)).toBe(0);
    const p = inst.trigger();
    t.advance(400);
    expect(type(root)).toBeGreaterThan(0);
    expect(type(root)).toBeLessThan(long.replace(/\s/g, '').length);
    t.advance(2100);
    await p;
    expect(type(root)).toBe(long.replace(/\s/g, '').length);
    expect(root.dataset.state).toBe('done');
    expect(t.stingers.length).toBeGreaterThan(0);
    expect(t.pending()).toBe(0);
  });

  it('typewriter fades in on lite and is static on reduced', async () => {
    const lite = setup(kineticProse, 'typewriter-echo', 'lite');
    const p = lite.inst.trigger();
    expect(lite.root.dataset.state).toBe('playing');
    lite.t.advance(700);
    await p;
    expect(lite.root.dataset.state).toBe('done');
    const still = setup(kineticProse, 'typewriter-echo', 'reduced');
    expect(still.root.dataset.state).toBe('done');
    expect(still.root.classList.contains('is-typing')).toBe(false);
    await still.inst.trigger();
    expect([still.t.stingers, still.t.haptics, still.t.pending()]).toEqual([[], [], 0]);
  });

  it('live downgrade mid-typing finishes instantly', async () => {
    const { root, t, inst } = setup(kineticProse, 'typewriter-echo', 'high');
    const p = inst.trigger();
    t.advance(100);
    t.setTier('reduced');
    await p;
    const total = (bpOf('typewriter-echo').defaultProps.text as string).replace(/\s/g, '').length;
    expect(type(root)).toBe(total);
    expect(t.pending()).toBe(0);
  });

  it('every effect plays and resolves on high and lite', async () => {
    for (const effect of ['shiver', 'drop-cap', 'typewriter', 'echo', 'sink', 'pulse']) {
      for (const tier of ['high', 'lite'] as const) {
        const { root, t, inst } = setup(kineticProse, 'whisper-shiver', tier, { effect });
        const p = inst.trigger();
        t.advance(3000);
        await p;
        expect(root.dataset.state).toBe('done');
        expect(root.dataset.layout).toBe(effect);
        expect(t.pending()).toBe(0);
      }
    }
  });

  it('emphasisWord is matched case-insensitively and wrapped once', () => {
    const { root } = setup(kineticProse, 'whisper-shiver', 'reduced', {
      emphasisWord: 'WHISPERED',
    });
    const em = root.querySelectorAll('.kn-e-kinetic-prose__em');
    expect(em).toHaveLength(1);
    expect(em[0]!.textContent).toBe('whispered');
  });

  it('drop-cap splits the first letter; echo adds a ghost layer', () => {
    const d = setup(kineticProse, 'whisper-shiver', 'high', { effect: 'drop-cap' });
    expect(d.root.querySelector('.kn-e-kinetic-prose__cap')!.textContent).toBe('S');
    const e = setup(kineticProse, 'whisper-shiver', 'high', { effect: 'echo' });
    expect(e.root.querySelectorAll('.kn-e-kinetic-prose__ghost')).toHaveLength(1);
  });

  it('pausing marks the root so CSS animations hold', () => {
    const { root, t } = setup(kineticProse, 'whisper-shiver', 'high');
    t.pause();
    expect(root.dataset.paused).toBe('true');
    t.resume();
    expect(root.dataset.paused).toBeUndefined();
  });

  it('renders author text as text, never markup', () => {
    const { root } = setup(kineticProse, 'typewriter-echo', 'high', {
      text: EVIL,
      emphasisWord: 'onerror',
    });
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('.kn-e-sr')!.textContent).toBe(EVIL);
  });

  it('destroy is idempotent and leaves nothing pending', () => {
    const { root, t, inst } = setup(kineticProse, 'typewriter-echo', 'high');
    void inst.trigger();
    inst.destroy();
    inst.destroy();
    expect(document.body.contains(root)).toBe(false);
    expect(t.pending()).toBe(0);
  });
});
