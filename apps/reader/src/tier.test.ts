import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PREFS, soundAllowed } from './prefs.ts';
import { deviceHints, resolveTier } from './tier.ts';

describe('resolveTier', () => {
  it('always honours OS reduced motion', () => {
    expect(resolveTier('high', { reducedMotion: true })).toBe('reduced');
  });
  it('respects an explicit choice', () => {
    expect(resolveTier('lite', { reducedMotion: false, deviceMemory: 8 })).toBe('lite');
  });
  it('drops weak or data-saving devices to lite on auto', () => {
    expect(resolveTier('auto', { reducedMotion: false, deviceMemory: 2 })).toBe('lite');
    expect(resolveTier('auto', { reducedMotion: false, saveData: true })).toBe('lite');
    expect(resolveTier('auto', { reducedMotion: false, deviceMemory: 6, cores: 8 })).toBe('high');
  });
  it('host reduced-motion overrides any preference, even without the media query', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('navigator', { hardwareConcurrency: 8 });
    for (const pref of ['auto', 'high', 'lite'] as const) {
      expect(resolveTier(pref, deviceHints(true))).toBe('reduced');
    }
    expect(resolveTier('auto', deviceHints(false))).toBe('high');
    vi.unstubAllGlobals();
  });
});

describe('Calm Mode override', () => {
  it('resolves reduced whatever the tier choice, via the host-reduced input', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('navigator', { hardwareConcurrency: 8 });
    for (const pref of ['auto', 'high', 'lite', 'reduced'] as const) {
      expect(resolveTier(pref, deviceHints(true))).toBe('reduced');
    }
  });
  it('leaves prior behaviour untouched when off', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('navigator', { hardwareConcurrency: 8 });
    expect(resolveTier('lite', deviceHints(false))).toBe('lite');
    expect(resolveTier('auto', deviceHints(false))).toBe('high');
  });
  it('mutes audio only through the pure soundAllowed decision', () => {
    const base = { ...DEFAULT_PREFS };
    expect(soundAllowed(base)).toBe(true);
    expect(soundAllowed({ ...base, calmMode: true })).toBe(false);
    expect(soundAllowed({ ...base, sound: false })).toBe(false);
  });
});
