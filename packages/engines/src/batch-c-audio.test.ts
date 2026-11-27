// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { setup } from './batch-c-setup.ts';

describe('audio-bed', () => {
  it('always shows a calm labelled pill', () => {
    const { root } = setup('rain-on-tin', 'high');
    expect(root.getAttribute('aria-label')).toBe('Ambient sound: Rain');
    expect(root.textContent).toContain('Rain');
    expect(root.textContent).toContain('crossfade 4 s');
    expect(root.dataset.state).toBe('idle');
  });

  it('is muted ("sound off") when audio is locked', async () => {
    const { root, t, inst } = setup('rain-on-tin', 'high', {}, false, false);
    await inst.trigger();
    expect(t.graphs).toHaveLength(0);
    expect(root.dataset.state).toBe('muted');
    expect(root.textContent).toContain('sound off');
  });

  it('builds a bed graph on trigger and stops with reduced', async () => {
    const { root, t, inst } = setup('rain-on-tin', 'high');
    await inst.trigger();
    expect(t.graphs).toHaveLength(1);
    expect(t.graphs[0]!.kind).toBe('bed');
    expect(root.dataset.state).toBe('playing');
    t.setTier('reduced');
    expect(t.graphs[0]!.closed).toBe(true);
    expect(root.dataset.state).toBe('muted');
    expect(t.pending()).toBe(0);
    await inst.trigger();
    expect(t.graphs).toHaveLength(1);
  });

  it('pause ramps down and resume restores; calm mounts silent', async () => {
    const { root, t, inst } = setup('barroom-hum', 'high');
    await inst.trigger();
    t.pause();
    t.resume();
    expect(root.dataset.state).toBe('playing');
    const calm = setup('barroom-hum', 'high', {}, true);
    await calm.inst.trigger();
    expect(calm.t.graphs).toHaveLength(0);
    expect(calm.root.textContent).toContain('sound off');
  });

  it('only one bed plays at a time: a new bed releases the previous one', async () => {
    const a = setup('rain-on-tin', 'high');
    await a.inst.trigger();
    const b = setup('barroom-hum', 'high');
    await b.inst.trigger();
    expect(a.root.dataset.state).toBe('stopped');
    expect(b.root.dataset.state).toBe('playing');
    expect(a.t.pending()).toBe(1);
    a.t.advance(500);
    expect(a.t.pending()).toBe(1);
    a.t.advance(5000);
    expect(a.t.pending()).toBe(0);
  });

  it('stop mode fades the active bed out instead of starting one', async () => {
    const a = setup('rain-on-tin', 'high');
    await a.inst.trigger();
    const s = setup('rain-on-tin', 'high', { stop: true });
    await s.inst.trigger();
    expect(s.t.graphs).toHaveLength(0);
    expect(a.root.dataset.state).toBe('stopped');
    expect(s.root.textContent).toContain('fading out');
  });

  it('destroy leaves nothing pending', async () => {
    const { t, inst, root } = setup('rain-on-tin', 'high');
    await inst.trigger();
    inst.destroy();
    inst.destroy();
    expect(document.body.contains(root)).toBe(false);
    expect(t.pending()).toBe(0);
  });
});

describe('audio-stinger', () => {
  it('renders a caption and a hairline on high; reduced is a quiet caption', () => {
    const high = setup('blade-unsheathe', 'high');
    expect(high.root.querySelector('.kn-e-audio-stinger__hair')).not.toBeNull();
    expect(high.root.getAttribute('aria-label')).toBe('Sound cue: Steel slid from its scabbard');
    const r = setup('blade-unsheathe', 'reduced');
    expect(r.root.dataset.tier).toBe('reduced');
    expect(r.root.textContent).toContain('Steel slid');
  });

  it('plays on a oneshot graph, pulses, and settles within 0.9 s', async () => {
    const { root, t, inst } = setup('level-up-chord', 'high');
    const p = inst.trigger();
    expect(t.graphs.map((g) => g.kind)).toEqual(['oneshot']);
    expect(root.classList.contains('is-pulse')).toBe(true);
    t.advance(901);
    await p;
    expect(root.classList.contains('is-pulse')).toBe(false);
    expect(t.pending()).toBe(0);
  });

  it('every foley builds without throwing', async () => {
    for (const foley of [
      'unsheathe',
      'thunder',
      'level-chord',
      'revolver-click',
      'typewriter-bell',
      'heartbeat',
      'radio-static',
    ]) {
      const { t, inst } = setup('blade-unsheathe', 'lite', { foley, pitchShift: 3 });
      const p = inst.trigger();
      t.advance(1000);
      await p;
      expect(t.graphs).toHaveLength(1);
      inst.destroy();
    }
  });

  it('reduced and calm are silent; live reduced silences and resolves', async () => {
    for (const calm of [false, true]) {
      const { t, inst } = setup('level-up-chord', 'reduced', {}, calm);
      await inst.trigger();
      expect(t.graphs).toHaveLength(0);
    }
    const { t, inst } = setup('level-up-chord', 'high');
    const p = inst.trigger();
    t.setTier('reduced');
    await p;
    expect(t.graphs[0]!.closed).toBe(true);
    expect(t.pending()).toBe(0);
  });

  it('pause silences the running shot; locked audio shows no graph', async () => {
    const a = setup('blade-unsheathe', 'high');
    const p = a.inst.trigger();
    a.t.pause();
    await p;
    expect(a.t.pending()).toBe(0);
    const b = setup('blade-unsheathe', 'high', {}, false, false);
    const q = b.inst.trigger();
    b.t.advance(901);
    await q;
    expect(b.t.graphs).toHaveLength(0);
  });
});
