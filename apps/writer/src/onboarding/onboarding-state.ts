// First-run welcome tour state. Persisted under `setting/onboarding`; shown only on a fresh
// workspace (just the demo novel), never after completion / dismissal, restore or real novels.
import type { NovelRepository } from '../store/repository.ts';
import { keys } from '../store/documents.ts';
import { DEMO_NOVEL_ID } from '../store/demo.ts';
import type { GlyphName } from '../ui/Glyph.tsx';

export interface OnboardingSettings {
  completedAt?: number;
  dismissedAt?: number;
}

export type OnboardingOutcome = 'completed' | 'dismissed';

const KEY = keys.setting('onboarding');

export async function loadOnboarding(repo: NovelRepository): Promise<OnboardingSettings> {
  const raw = (await repo.docs.read<unknown>(KEY))?.data;
  if (!raw || typeof raw !== 'object') return {};
  const s = raw as Record<string, unknown>;
  const out: OnboardingSettings = {};
  if (typeof s.completedAt === 'number') out.completedAt = s.completedAt;
  if (typeof s.dismissedAt === 'number') out.dismissedAt = s.dismissedAt;
  return out;
}

export async function markOnboarding(
  repo: NovelRepository,
  outcome: OnboardingOutcome,
  now: number = Date.now(),
): Promise<OnboardingSettings> {
  const next: OnboardingSettings = {
    ...(await loadOnboarding(repo)),
    ...(outcome === 'completed' ? { completedAt: now } : { dismissedAt: now }),
  };
  await repo.docs.write(KEY, next);
  return next;
}

/** "Replay welcome tour": forgets any earlier outcome. */
export async function resetOnboarding(repo: NovelRepository): Promise<void> {
  await repo.docs.write(KEY, {});
}

/** True when the shelf holds any novel other than the bundled demo. */
export function hasUserNovels(novelIds: readonly string[]): boolean {
  return novelIds.some((id) => id !== DEMO_NOVEL_ID);
}

export function shouldShowOnboarding(input: {
  hasUserNovels: boolean;
  restoredBackup?: boolean;
  settings: OnboardingSettings;
}): boolean {
  if (input.hasUserNovels || input.restoredBackup) return false;
  return input.settings.completedAt === undefined && input.settings.dismissedAt === undefined;
}

export interface TourStep {
  id: 'preview' | 'customize' | 'start';
  title: string;
  body: string;
  icon: GlyphName;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'preview',
    title: 'Experience live interactive prose',
    body: 'Chrome Tide · Snake Eyes is ready to play. Open Live Preview to feel a 3D Dice roll and a Cyberbrain chat land inside the story, right on your phone.',
    icon: 'play-circle',
  },
  {
    id: 'customize',
    title: 'Classic or interactive, your call',
    body: 'Write a clean classic novel or keep notes with nothing in your way. Choose Interactive Studio for a book to add kinetic cues, tweaked with simple controls. No code, no markup.',
    icon: 'sliders',
  },
  {
    id: 'start',
    title: 'Start writing & protect your work',
    body: 'Begin a novel (switch modes anytime without losing a word), bring in a document, or restore a backup. On Android, link an external backup folder (Settings › Backup & Restore) so backups survive a phone change.',
    icon: 'shield',
  },
];
