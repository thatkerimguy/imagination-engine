import { describe, expect, it } from 'vitest';
import { createPauseGate, LIFECYCLE_EVENT, type GateEnv } from './pause-gate.ts';

function setup() {
  const doc = Object.assign(new EventTarget(), { hidden: false });
  const win = new EventTarget();
  const env: GateEnv = { doc, win };
  const ac = new AbortController();
  const calls: boolean[] = [];
  const gate = createPauseGate(ac.signal, (p) => calls.push(p), env);
  const lifecycle = (active: boolean): boolean =>
    win.dispatchEvent(new CustomEvent(LIFECYCLE_EVENT, { detail: { active } }));
  const visibility = (hidden: boolean): boolean => {
    doc.hidden = hidden;
    return doc.dispatchEvent(new Event('visibilitychange'));
  };
  return { gate, ac, calls, lifecycle, visibility };
}

describe('pause gate', () => {
  it('pauses on a background lifecycle event and resumes on active', () => {
    const s = setup();
    s.lifecycle(false);
    expect(s.gate.paused).toBe(true);
    s.lifecycle(true);
    expect(s.gate.paused).toBe(false);
    expect(s.calls).toEqual([true, false]);
  });
  it('pauses when hidden and resumes only when visible and active', () => {
    const s = setup();
    s.visibility(true);
    expect(s.gate.paused).toBe(true);
    s.lifecycle(false);
    s.visibility(false);
    expect(s.gate.paused).toBe(true);
    s.lifecycle(true);
    expect(s.gate.paused).toBe(false);
    expect(s.calls).toEqual([true, false]);
  });
  it('detaches every listener on abort', () => {
    const s = setup();
    s.ac.abort();
    s.lifecycle(false);
    s.visibility(true);
    expect(s.calls).toEqual([]);
  });
});
