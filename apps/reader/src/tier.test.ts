import { describe, expect, it } from 'vitest';
import { resolveTier } from './tier.ts';

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
});
