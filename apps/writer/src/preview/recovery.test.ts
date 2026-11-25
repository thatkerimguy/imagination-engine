import { describe, expect, it } from 'vitest';
import {
  initialRecovery,
  manualReload,
  MAX_RECOVERIES,
  recordRendererGone,
  RECOVERY_WINDOW_MS,
  recoveryLog,
} from './recovery.ts';

describe('preview renderer recovery', () => {
  it('remounts with a new generation for the first crashes', () => {
    let s = initialRecovery;
    for (let i = 1; i <= MAX_RECOVERIES; i++) {
      const r = recordRendererGone(s, 1000 * i);
      expect(r.action).toBe('remount');
      expect(r.state.generation).toBe(i);
      s = r.state;
    }
  });

  it('gives up after too many crashes inside the window and keeps the generation', () => {
    let s = initialRecovery;
    for (let i = 0; i < MAX_RECOVERIES; i++) s = recordRendererGone(s, i * 100).state;
    const r = recordRendererGone(s, 500);
    expect(r.action).toBe('give-up');
    expect(r.state.gaveUp).toBe(true);
    expect(r.state.generation).toBe(s.generation);
  });

  it('forgets crashes that fall outside the window', () => {
    let s = initialRecovery;
    for (let i = 0; i < MAX_RECOVERIES; i++) s = recordRendererGone(s, i).state;
    const r = recordRendererGone(s, RECOVERY_WINDOW_MS + 10);
    expect(r.action).toBe('remount');
    expect(r.state.crashes).toHaveLength(1);
  });

  it('manual reload resets the budget and bumps the key', () => {
    let s = initialRecovery;
    for (let i = 0; i <= MAX_RECOVERIES; i++) s = recordRendererGone(s, i).state;
    expect(s.gaveUp).toBe(true);
    const next = manualReload(s);
    expect(next).toEqual({ crashes: [], generation: s.generation + 1, gaveUp: false });
  });

  it('logs counts only', () => {
    const line = recoveryLog(false, 'remount', recordRendererGone(initialRecovery, 0).state);
    expect(line).toContain('low memory');
    expect(line).toContain('1/3');
  });
});
