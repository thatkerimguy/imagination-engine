// Play-compliant in-app review gating (pure). We never ask "are you enjoying…": the system review
// sheet is requested at most twice a year, only right after a successful export / publish /
// backup / teaser, for writers who have genuinely used the app, and never while locked or after a crash.
export interface ReviewPromptState {
  firstSeenAt: string;
  /** Distinct local-ish `YYYY-MM-DD` days the app was opened (newest last, capped). */
  activeDays: string[];
  milestonesCompleted: number;
  /** ISO timestamps of past review requests (newest last). */
  promptHistory: string[];
}

export type ReviewTrigger = 'export' | 'publish' | 'backup' | 'teaser' | 'typing' | 'launch';

export interface ReviewContext {
  trigger: ReviewTrigger;
  authoredWords: number;
  isLocked: boolean;
  hadCrashThisSession: boolean;
  now: string;
}

export const MAX_ACTIVE_DAYS = 60;
export const MAX_PROMPT_HISTORY = 10;
export const MIN_ACTIVE_DAYS = 3;
export const MIN_AUTHORED_WORDS = 500;
export const MIN_DAYS_BETWEEN_PROMPTS = 90;
export const MAX_PROMPTS_PER_YEAR = 2;
const DAY_MS = 86_400_000;
const POSITIVE_TRIGGERS: readonly ReviewTrigger[] = ['export', 'publish', 'backup', 'teaser'];

export const emptyReviewState = (nowIso: string): ReviewPromptState => ({
  firstSeenAt: nowIso,
  activeDays: [],
  milestonesCompleted: 0,
  promptHistory: [],
});

/** Coerces stored JSON into a valid state (unknown shapes reset to empty). */
export function sanitizeReviewState(raw: unknown, nowIso: string): ReviewPromptState {
  const r = (raw ?? {}) as Partial<ReviewPromptState>;
  const strings = (v: unknown, cap: number): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-cap) : [];
  return {
    firstSeenAt: typeof r.firstSeenAt === 'string' ? r.firstSeenAt : nowIso,
    activeDays: strings(r.activeDays, MAX_ACTIVE_DAYS),
    milestonesCompleted:
      typeof r.milestonesCompleted === 'number' && r.milestonesCompleted >= 0
        ? Math.floor(r.milestonesCompleted)
        : 0,
    promptHistory: strings(r.promptHistory, MAX_PROMPT_HISTORY),
  };
}

/** Adds today's `YYYY-MM-DD` once; keeps the newest {@link MAX_ACTIVE_DAYS}. */
export function recordActiveDay(state: ReviewPromptState, nowIso: string): ReviewPromptState {
  const day = nowIso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || state.activeDays.includes(day)) return state;
  return { ...state, activeDays: [...state.activeDays, day].slice(-MAX_ACTIVE_DAYS) };
}

export const recordMilestone = (state: ReviewPromptState): ReviewPromptState => ({
  ...state,
  milestonesCompleted: state.milestonesCompleted + 1,
});

export const recordPrompt = (state: ReviewPromptState, nowIso: string): ReviewPromptState => ({
  ...state,
  promptHistory: [...state.promptHistory, nowIso].slice(-MAX_PROMPT_HISTORY),
});

export function shouldRequestReview(state: ReviewPromptState, ctx: ReviewContext): boolean {
  if (!POSITIVE_TRIGGERS.includes(ctx.trigger)) return false;
  if (ctx.isLocked || ctx.hadCrashThisSession) return false;
  if (state.activeDays.length < MIN_ACTIVE_DAYS || ctx.authoredWords < MIN_AUTHORED_WORDS)
    return false;
  const now = Date.parse(ctx.now);
  if (Number.isNaN(now)) return false;
  const past = state.promptHistory.map((p) => Date.parse(p)).filter((p) => !Number.isNaN(p));
  const last = Math.max(-Infinity, ...past);
  if (now - last < MIN_DAYS_BETWEEN_PROMPTS * DAY_MS) return false;
  const inYear = past.filter((p) => now - p < 365 * DAY_MS).length;
  return inYear < MAX_PROMPTS_PER_YEAR;
}
