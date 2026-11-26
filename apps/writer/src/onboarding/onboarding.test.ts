import { describe, expect, it } from 'vitest';
import { DEMO_NOVEL_ID } from '../store/demo.ts';
import { NovelRepository } from '../store/repository.ts';
import { createMemoryDatabase } from '../db/memory-driver.ts';
import {
  hasUserNovels,
  loadOnboarding,
  markOnboarding,
  resetOnboarding,
  shouldShowOnboarding,
  TOUR_STEPS,
} from './onboarding-state.ts';

const repo = (): NovelRepository => new NovelRepository(createMemoryDatabase(), () => 5);

describe('shouldShowOnboarding', () => {
  it('shows for a fresh workspace', () => {
    expect(shouldShowOnboarding({ hasUserNovels: false, settings: {} })).toBe(true);
  });
  it('hides after completion or dismissal', () => {
    expect(shouldShowOnboarding({ hasUserNovels: false, settings: { completedAt: 1 } })).toBe(
      false,
    );
    expect(shouldShowOnboarding({ hasUserNovels: false, settings: { dismissedAt: 1 } })).toBe(
      false,
    );
  });
  it('hides with user novels or a restored backup', () => {
    expect(shouldShowOnboarding({ hasUserNovels: true, settings: {} })).toBe(false);
    expect(shouldShowOnboarding({ hasUserNovels: false, restoredBackup: true, settings: {} })).toBe(
      false,
    );
  });
});

describe('hasUserNovels', () => {
  it('ignores the demo novel', () => {
    expect(hasUserNovels([])).toBe(false);
    expect(hasUserNovels([DEMO_NOVEL_ID])).toBe(false);
    expect(hasUserNovels([DEMO_NOVEL_ID, 'mine'])).toBe(true);
  });
});

describe('persistence', () => {
  it('round-trips and resets', async () => {
    const r = repo();
    expect(await loadOnboarding(r)).toEqual({});
    await markOnboarding(r, 'dismissed', 10);
    expect(await loadOnboarding(r)).toEqual({ dismissedAt: 10 });
    await markOnboarding(r, 'completed', 20);
    expect(await loadOnboarding(r)).toEqual({ dismissedAt: 10, completedAt: 20 });
    await resetOnboarding(r);
    expect(await loadOnboarding(r)).toEqual({});
  });
  it('has three tour steps', () => {
    expect(TOUR_STEPS).toHaveLength(3);
  });
});
