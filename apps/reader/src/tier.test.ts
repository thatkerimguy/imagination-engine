import { describe, expect, it, vi } from 'vitest';
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
