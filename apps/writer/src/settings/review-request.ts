// Native in-app review request (Google Play In-App Review / StoreKit). Fully non-blocking and
// never throws. Only the system sheet is used: no custom "Are you enjoying…" pre-dialog.
import * as StoreReview from 'expo-store-review';
import { crashReporter } from '../observability/reporter.ts';
import { loadLockConfig } from '../security/lock.ts';
import { DEMO_NOVEL_ID } from '../store/demo.ts';
import { keys } from '../store/documents.ts';
import type { NovelRepository } from '../store/repository.ts';
import { unlockSession } from '../store/unlock-session.ts';
import {
  recordActiveDay,
  recordMilestone,
  recordPrompt,
  sanitizeReviewState,
  shouldRequestReview,
  type ReviewPromptState,
  type ReviewTrigger,
} from './review-prompt.ts';

const KEY = keys.setting('review-prompt');

async function load(repo: NovelRepository, now: string): Promise<ReviewPromptState> {
  return sanitizeReviewState((await repo.docs.read<unknown>(KEY))?.data, now);
}

/** Words the writer actually authored (the bundled demo novel does not count). */
async function authoredWords(repo: NovelRepository): Promise<number> {
  const novels = await repo.listNovels();
  return novels.filter((n) => n.id !== DEMO_NOVEL_ID).reduce((sum, n) => sum + n.words, 0);
}

async function isLocked(repo: NovelRepository): Promise<boolean> {
  const config = await loadLockConfig(repo.docs);
  return config?.enabled === true && !unlockSession.isMasterUnlocked();
}

/** Counts today as an active day (call once on app start). */
export async function recordActiveDayAsync(repo: NovelRepository): Promise<void> {
  try {
    const now = new Date().toISOString();
    await repo.docs.write(KEY, recordActiveDay(await load(repo, now), now));
  } catch {
    // Review bookkeeping must never disturb the app.
  }
}

/** After a successful export / publish / backup / teaser: maybe ask for a review. Never throws. */
export async function maybeRequestReview(
  repo: NovelRepository,
  trigger: ReviewTrigger,
): Promise<void> {
  try {
    const now = new Date().toISOString();
    let state = recordMilestone(await load(repo, now));
    const ask =
      shouldRequestReview(state, {
        trigger,
        authoredWords: await authoredWords(repo),
        isLocked: await isLocked(repo),
        // Any error in this session's local crash ring means "do not ask".
        hadCrashThisSession: crashReporter.ring.list().length > 0,
        now,
      }) && (await StoreReview.isAvailableAsync());
    if (ask) {
      await StoreReview.requestReview();
      state = recordPrompt(state, now);
    }
    await repo.docs.write(KEY, state);
  } catch {
    // Best effort only.
  }
}
