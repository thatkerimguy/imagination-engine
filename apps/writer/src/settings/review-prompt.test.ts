import { describe, expect, it } from 'vitest';
import {
  emptyReviewState,
  MAX_ACTIVE_DAYS,
  recordActiveDay,
  recordMilestone,
  recordPrompt,
  sanitizeReviewState,
  shouldRequestReview,
  type ReviewContext,
  type ReviewPromptState,
} from './review-prompt.ts';

const NOW = '2026-06-01T10:00:00.000Z';
const day = (n: number): number => n * 86_400_000;
const ago = (days: number): string => new Date(Date.parse(NOW) - day(days)).toISOString();

const state = (over: Partial<ReviewPromptState> = {}): ReviewPromptState => ({
  firstSeenAt: ago(30),
  activeDays: ['2026-05-01', '2026-05-10', '2026-05-20'],
  milestonesCompleted: 1,
  promptHistory: [],
  ...over,
});
const ctx = (over: Partial<ReviewContext> = {}): ReviewContext => ({
  trigger: 'export',
  authoredWords: 500,
  isLocked: false,
  hadCrashThisSession: false,
  now: NOW,
  ...over,
});

describe('state recorders', () => {
  it('dedupes active days and caps the list', () => {
    let s = emptyReviewState(NOW);
    s = recordActiveDay(s, '2026-05-01T08:00:00Z');
    s = recordActiveDay(s, '2026-05-01T22:00:00Z');
    expect(s.activeDays).toEqual(['2026-05-01']);
    for (let i = 0; i < MAX_ACTIVE_DAYS + 10; i++)
      s = recordActiveDay(s, new Date(Date.UTC(2025, 0, 1 + i)).toISOString());
    expect(s.activeDays).toHaveLength(MAX_ACTIVE_DAYS);
    expect(recordActiveDay(s, 'garbage')).toBe(s);
  });

  it('counts milestones and prompts without mutating', () => {
    const s = emptyReviewState(NOW);
    expect(recordMilestone(s).milestonesCompleted).toBe(1);
    expect(recordPrompt(s, NOW).promptHistory).toEqual([NOW]);
    expect(s.milestonesCompleted).toBe(0);
    expect(s.promptHistory).toEqual([]);
  });

  it('sanitises stored junk', () => {
    expect(sanitizeReviewState(null, NOW)).toEqual(emptyReviewState(NOW));
    expect(sanitizeReviewState({ activeDays: [1, 'x'], milestonesCompleted: -4 }, NOW)).toEqual({
      ...emptyReviewState(NOW),
      activeDays: ['x'],
    });
  });
});

describe('shouldRequestReview', () => {
  it('passes at exactly the minimums', () => {
    expect(shouldRequestReview(state(), ctx())).toBe(true);
  });

  it.each(['export', 'publish', 'backup', 'teaser'] as const)('allows trigger %s', (trigger) => {
    expect(shouldRequestReview(state(), ctx({ trigger }))).toBe(true);
  });

  it.each(['typing', 'launch'] as const)('refuses trigger %s', (trigger) => {
    expect(shouldRequestReview(state(), ctx({ trigger }))).toBe(false);
  });

  it('needs 3 active days', () => {
    expect(shouldRequestReview(state({ activeDays: ['a', 'b'] }), ctx())).toBe(false);
  });

  it('needs 500 authored words', () => {
    expect(shouldRequestReview(state(), ctx({ authoredWords: 499 }))).toBe(false);
  });

  it('refuses while locked or after a crash', () => {
    expect(shouldRequestReview(state(), ctx({ isLocked: true }))).toBe(false);
    expect(shouldRequestReview(state(), ctx({ hadCrashThisSession: true }))).toBe(false);
  });

  it('enforces 90 days since the last prompt (boundary inclusive)', () => {
    expect(shouldRequestReview(state({ promptHistory: [ago(89)] }), ctx())).toBe(false);
    expect(shouldRequestReview(state({ promptHistory: [ago(90)] }), ctx())).toBe(true);
  });

  it('allows at most two prompts in the trailing 365 days', () => {
    expect(shouldRequestReview(state({ promptHistory: [ago(300), ago(100)] }), ctx())).toBe(false);
    expect(shouldRequestReview(state({ promptHistory: [ago(366), ago(100)] }), ctx())).toBe(true);
    expect(shouldRequestReview(state({ promptHistory: [ago(364), ago(100)] }), ctx())).toBe(false);
    expect(shouldRequestReview(state({ promptHistory: [ago(200)] }), ctx())).toBe(true);
  });

  it('refuses an invalid clock', () => {
    expect(shouldRequestReview(state(), ctx({ now: 'nope' }))).toBe(false);
  });
});
