// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { EVIL, setup } from './batch-b-setup.ts';
import telemetryMeter from './telemetry-meter/index.ts';

describe('telemetry-meter', () => {
  it('renders an accessible SVG meter with no canvas', () => {
    const { root } = setup(telemetryMeter, 'ekg-vitals', 'high');
    const m = root.querySelector('[role=meter]')!;
    expect(m.getAttribute('aria-label')).toBe('Heart rate');
    expect(m.getAttribute('aria-valuemin')).toBe('0');
    expect(m.getAttribute('aria-valuemax')).toBe('200');
    expect(root.querySelector('svg')).not.toBeNull();
    expect(root.querySelector('canvas')).toBeNull();
  });

  it('high trigger counts up to the value, lands, and the ekg loop keeps running', async () => {
    const { root, t, inst } = setup(telemetryMeter, 'ekg-vitals', 'high');
    const num = root.querySelector('.kn-e-telemetry-meter__num')!;
    const p = inst.trigger();
    t.frames(10);
    expect(Number(num.textContent)).toBeGreaterThan(0);
    expect(Number(num.textContent)).toBeLessThan(112);
    t.frames(80);
    await p;
    expect(num.textContent).toBe('112');
    expect(root.querySelector('[role=meter]')!.getAttribute('aria-valuenow')).toBe('112');
    expect(root.dataset.state).toBe('done');
    expect(t.stingers).toEqual(['beep']);
    expect(t.pending()).toBeGreaterThan(0);
  });

  it('pausing stops progress; resuming continues', async () => {
    const { root, t, inst } = setup(telemetryMeter, 'ekg-vitals', 'high');
    const num = root.querySelector('.kn-e-telemetry-meter__num')!;
    const p = inst.trigger();
    t.frames(10);
    const before = num.textContent;
    t.pause();
    t.frames(60);
    expect(num.textContent).toBe(before);
    t.resume();
    t.frames(80);
    await p;
    expect(num.textContent).toBe('112');
  });

  it('destroy cancels loops: nothing pending even before dispose', () => {
    const { t, inst } = setup(telemetryMeter, 'ekg-vitals', 'high');
    void inst.trigger();
    t.frames(100);
    expect(t.pending()).toBeGreaterThan(0);
    inst.destroy();
    inst.destroy();
    expect(t.pending()).toBe(0);
    t.dispose();
    expect(t.pending()).toBe(0);
  });

  it('live downgrade to reduced cancels raf loops and shows the static final readout', async () => {
    const { root, t, inst } = setup(telemetryMeter, 'ekg-vitals', 'high');
    const p = inst.trigger();
    t.frames(100);
    expect(t.pending()).toBeGreaterThan(0);
    t.setTier('reduced');
    await p;
    expect(t.pending()).toBe(0);
    expect(root.querySelector('.kn-e-telemetry-meter__num')!.textContent).toBe('112');
  });

  it('lite uses a single timeout: no raf, no loops', async () => {
    const { root, t, inst } = setup(telemetryMeter, 'ekg-vitals', 'lite');
    const p = inst.trigger();
    t.frames(5);
    t.advance(400);
    await p;
    expect(root.querySelector('.kn-e-telemetry-meter__num')!.textContent).toBe('112');
    expect(t.pending()).toBe(0);
  });

  it('reduced and calm are static, silent and resolve immediately', async () => {
    for (const calm of [false, true]) {
      const { root, t, inst } = setup(telemetryMeter, 'ekg-vitals', 'reduced', {}, calm);
      expect(root.querySelector('.kn-e-telemetry-meter__num')!.textContent).toBe('112');
      await inst.trigger();
      expect([t.stingers, t.haptics, t.pending()]).toEqual([[], [], 0]);
    }
  });

  it('flags the warn colour past the threshold (bars warn when depleted)', () => {
    expect(setup(telemetryMeter, 'ekg-vitals', 'lite').root.dataset.over).toBe('false');
    expect(setup(telemetryMeter, 'ekg-vitals', 'lite', { value: 168 }).root.dataset.over).toBe(
      'true',
    );
    expect(setup(telemetryMeter, 'sanity-gauge', 'lite').root.dataset.over).toBe('true');
  });

  it('countdown shows mm:ss and ticks down once per second', async () => {
    const { root, t, inst } = setup(telemetryMeter, 'ekg-vitals', 'high', {
      style: 'countdown',
      value: 75,
      max: 120,
    });
    const num = root.querySelector('.kn-e-telemetry-meter__num')!;
    const p = inst.trigger();
    t.frames(80);
    await p;
    expect(num.textContent).toBe('01:15');
    t.advance(2000);
    expect(num.textContent).toBe('01:13');
  });

  it('radar sweeps via raf until destroyed; compass rotates to the value', async () => {
    const r = setup(telemetryMeter, 'ekg-vitals', 'high', { style: 'radar' });
    const p = r.inst.trigger();
    r.t.frames(80);
    await p;
    expect(r.t.pending()).toBe(1);
    r.inst.destroy();
    expect(r.t.pending()).toBe(0);
    const c = setup(telemetryMeter, 'ekg-vitals', 'high', {
      style: 'compass',
      value: 90,
      max: 360,
    });
    const q = c.inst.trigger();
    c.t.frames(80);
    await q;
    expect(c.root.querySelector<SVGElement>('.kn-e-telemetry-meter__needle')!.style.transform).toBe(
      'rotate(90deg)',
    );
    expect(c.t.pending()).toBe(0);
  });

  it('bars lists the extra readings', () => {
    const { root } = setup(telemetryMeter, 'sanity-gauge', 'reduced');
    expect(root.querySelectorAll('rect.kn-e-telemetry-meter__fill')).toHaveLength(3);
    expect(root.textContent).toContain('Stamina');
  });

  it('renders author text as text, never markup', () => {
    const { root } = setup(telemetryMeter, 'sanity-gauge', 'reduced', {
      label: EVIL,
      unit: EVIL,
      items: [{ name: EVIL, value: 5, max: 10 }],
    });
    expect(root.querySelector('img')).toBeNull();
    expect(root.textContent).toContain(EVIL.slice(0, 24).slice(0, 10));
  });
});
