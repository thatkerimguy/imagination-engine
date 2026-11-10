import type { FightBlock, StoryProject } from './schema.ts';

type Report = (
  severity: 'error' | 'warning',
  code: string,
  message: string,
  params: Record<string, string>,
  where?: string,
) => void;

/** Enemies: unique IDs and names in every language the novel has. */
export function checkEnemies(project: StoryProject, report: Report): void {
  const seen = new Set<string>();
  for (const enemy of project.enemies ?? []) {
    if (seen.has(enemy.id))
      report('error', 'duplicate-id', `The ID "${enemy.id}" is used twice.`, { id: enemy.id });
    seen.add(enemy.id);
    for (const locale of project.languages)
      if (!enemy.name[locale]?.trim())
        report(
          'warning',
          'enemy-name',
          `The enemy "${enemy.id}" has no ${locale === 'tr' ? 'Turkish' : 'English'} name.`,
          { id: enemy.id, locale },
        );
  }
}

/** The enemy and track a Fight block names. */
export function checkFightBlock(block: FightBlock, project: StoryProject, report: Report): void {
  if (!(project.enemies ?? []).some((e) => e.id === block.enemy))
    report(
      'error',
      'unknown-enemy',
      block.enemy ? `"${block.enemy}" isn't an enemy.` : 'This fight has no enemy.',
      { id: block.enemy },
      block.id,
    );
  if (block.track && !(project.audio?.tracks ?? []).some((t) => t.id === block.track))
    report(
      'error',
      'unknown-track',
      `"${block.track}" isn't a track.`,
      { id: block.track },
      block.id,
    );
}
