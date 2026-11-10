import type { Block, Chapter, ChoiceBlock, ChoiceOption, Passage, StoryProject } from './schema.ts';

type Report = (
  severity: 'error' | 'warning',
  code: string,
  message: string,
  params: Record<string, string>,
  where?: string,
) => void;

/** IDs a formula names in visited(), chosen(), owned() and quest(), checked once all are known. */
export interface PendingRefs {
  readonly passages: ReadonlySet<string>;
  readonly options: ReadonlySet<string>;
  readonly items: ReadonlySet<string>;
  readonly quests: ReadonlySet<string>;
  readonly where: string;
}

interface ReferenceInput {
  readonly project: StoryProject;
  readonly passages: ReadonlyMap<string, { passage: Passage; chapter: Chapter }>;
  readonly options: ReadonlyMap<string, { option: ChoiceOption; choice: ChoiceBlock }>;
  readonly targets: { readonly jump: ReadonlySet<string>; readonly call: ReadonlySet<string> };
  readonly pendingRefs: readonly PendingRefs[];
  readonly leaves: (list: readonly Block[]) => boolean;
  readonly report: Report;
}

/** What can only be checked after the whole story is walked: references, reachability, ends. */
export function checkReferences(input: ReferenceInput): void {
  const { project, passages, options, targets, pendingRefs, leaves, report } = input;
  const items = new Set((project.items ?? []).map((i) => i.id));
  const quests = new Set((project.quests ?? []).map((q) => q.id));
  for (const refs of pendingRefs) {
    for (const id of refs.passages)
      if (!passages.has(id))
        report(
          'error',
          'unknown-passage',
          `visited("${id}") names a passage that doesn't exist.`,
          { id },
          refs.where,
        );
    for (const id of refs.options)
      if (!options.has(id))
        report(
          'error',
          'unknown-option',
          `chosen("${id}") names an option that doesn't exist.`,
          { id },
          refs.where,
        );
    for (const id of refs.items)
      if (!items.has(id))
        report(
          'error',
          'unknown-item',
          `owned("${id}") names an item that doesn't exist.`,
          { id },
          refs.where,
        );
    for (const id of refs.quests)
      if (!quests.has(id))
        report(
          'error',
          'unknown-quest',
          `quest("${id}") names a quest that doesn't exist.`,
          { id },
          refs.where,
        );
  }

  if (!passages.has(project.start))
    report('error', 'start', `The start passage "${project.start}" doesn't exist.`, {
      id: project.start,
    });
  for (const [id, { passage }] of passages) {
    const name = passage.name ?? id;
    if (id !== project.start && !targets.jump.has(id) && !targets.call.has(id))
      report('warning', 'unreachable', `Nothing leads to passage "${name}".`, { name }, id);
    if (!targets.call.has(id) && !leaves(passage.blocks)) {
      report(
        'warning',
        'dead-end',
        `Passage "${name}" can run out without a Jump or End, so the story stops there.`,
        { name },
        id,
      );
    }
  }
  for (const def of project.variables) {
    if (def.type === 'enum' && !def.values?.length)
      report('error', 'enum-values', `One-of variable "${def.id}" has no values.`, { id: def.id });
  }
}
