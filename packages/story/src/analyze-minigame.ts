import { MINIGAME_DEFAULTS, minigameValues } from './minigame.ts';
import type { MinigameBlock, StoryProject, VariableType } from './schema.ts';

type Report = (
  severity: 'error' | 'warning',
  code: string,
  message: string,
  params: Record<string, string>,
  where?: string,
) => void;

const LANGUAGE_NAMES = { en: 'English', tr: 'Turkish' } as const;

/** A Minigame block: where its results go, its words in every language, and odds that make sense. */
export function checkMinigameBlock(
  block: MinigameBlock,
  project: StoryProject,
  report: Report,
  needVar: (id: string, where: string, type?: VariableType) => void,
): void {
  const { game } = block;
  if (block.score) needVar(block.score, block.id, 'number');
  const names = minigameValues(game);
  for (const [name, variable] of Object.entries(block.store ?? {})) {
    if (names.includes(name)) needVar(variable, block.id, 'number');
    else
      report(
        'error',
        'minigame-value',
        `A ${game.template} game has no "${name}" result.`,
        { name, template: game.template },
        block.id,
      );
  }

  const texts =
    game.template === 'cipher' ? game.words : game.template === 'typing' ? game.phrases : [];
  for (const locale of project.languages) {
    const blank = texts.some((text) => !text[locale]?.trim());
    if (blank)
      report(
        'warning',
        'minigame-text',
        `A ${game.template} game is missing its ${LANGUAGE_NAMES[locale]} text.`,
        { template: game.template, locale },
        block.id,
      );
    else if (
      game.template === 'cipher' &&
      game.words.some((word) => Array.from((word[locale] ?? '').replace(/\s/g, '')).length < 3)
    )
      report(
        'warning',
        'minigame-short',
        'A cipher word needs at least three letters to be a puzzle.',
        { locale },
        block.id,
      );
  }

  if (game.template === 'dice') {
    const d = MINIGAME_DEFAULTS.dice;
    const dice = game.dice ?? d.dice;
    const target = game.target ?? d.target;
    const most = dice * (game.sides ?? d.sides);
    if (target > most || target <= dice)
      report(
        'warning',
        'minigame-odds',
        target > most
          ? `These dice can't reach ${target}; the most they roll is ${most}.`
          : `These dice always reach ${target}.`,
        { target: String(target), most: String(most), sure: String(target <= dice) },
        block.id,
      );
  }
  if (game.template === 'tension') {
    const d = MINIGAME_DEFAULTS.tension;
    if ((game.hold ?? d.hold) >= (game.limit ?? d.limit))
      report(
        'warning',
        'minigame-odds',
        'The time limit is no longer than the time to hold, so this game can hardly be won.',
        { target: '', most: '', sure: 'false' },
        block.id,
      );
  }
}
