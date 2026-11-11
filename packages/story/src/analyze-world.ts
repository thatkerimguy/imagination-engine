import type { Expr } from './formula.ts';
import type { Formula, LocalText, StoryProject } from './schema.ts';
import type { ExitsBlock } from './world.ts';

type Report = (
  severity: 'error' | 'warning',
  code: string,
  message: string,
  params: Record<string, string>,
  where?: string,
) => void;

const LANGUAGE_NAMES = { en: 'English', tr: 'Turkish' } as const;

/** What the world checks borrow from the analyzer (see analyze.ts). */
export interface WorldCheckContext {
  readonly project: StoryProject;
  readonly report: Report;
  readonly passages: ReadonlyMap<string, unknown>;
  /** Exits blocks and the passage each one is in. */
  readonly exitsBlocks: readonly { readonly block: ExitsBlock; readonly passage: string }[];
  useFormula(formula: Formula, where: string): Expr | undefined;
  useText(text: LocalText, where: string): void;
  /** Passages something leads into; an exit adds its room's passage, so it counts as reachable. */
  readonly jumps: Set<string>;
}

/** Rooms, exits, Exits blocks and spaces (ADR 0031). */
export function checkWorld(ctx: WorldCheckContext): void {
  const { project, report } = ctx;
  const rooms = project.world?.rooms ?? [];
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const owner = new Map<string, string>();
  const squares = new Map<string, string>();
  const ids = new Set<string>();
  const unique = (id: string, where: string) => {
    if (ids.has(id))
      report('error', 'duplicate-id', `The ID "${id}" is used twice.`, { id }, where);
    ids.add(id);
  };

  for (const room of rooms) {
    unique(room.id, room.id);
    const name = room.name.en || room.name.tr || room.id;
    for (const locale of project.languages)
      if (!room.name[locale]?.trim())
        report(
          'warning',
          'data-name',
          `The room "${room.id}" has no ${LANGUAGE_NAMES[locale]} name.`,
          { id: room.id, kind: 'room', locale },
          room.id,
        );
    if (!room.passage)
      report('error', 'room-passage', `The room "${name}" has no passage.`, { name }, room.id);
    else if (!ctx.passages.has(room.passage))
      report(
        'error',
        'unknown-passage',
        `The passage "${room.passage}" does not exist.`,
        { id: room.passage },
        room.id,
      );
    else if (owner.has(room.passage))
      report(
        'error',
        'room-passage-twice',
        `Two rooms play the same passage: "${name}" and "${owner.get(room.passage)}".`,
        { name, other: owner.get(room.passage) ?? '' },
        room.id,
      );
    else owner.set(room.passage, name);
    const square = `${room.x},${room.y}`;
    const sharing = squares.get(square);
    if (sharing)
      report(
        'warning',
        'room-overlap',
        `"${name}" is on the same square of the map as "${sharing}".`,
        { name, other: sharing },
        room.id,
      );
    else squares.set(square, name);

    for (const exit of room.exits) {
      unique(exit.id, room.id);
      const target = byId.get(exit.to);
      if (!exit.to) report('error', 'exit-target', 'An exit leads nowhere yet.', { name }, room.id);
      else if (!target)
        report(
          'error',
          'unknown-room',
          `An exit leads to "${exit.to}", which isn't a room.`,
          { id: exit.to },
          room.id,
        );
      else if (target.passage) ctx.jumps.add(target.passage);
      if (exit.label) ctx.useText(exit.label, room.id);
      if (exit.lockedText) ctx.useText(exit.lockedText, room.id);
      if (exit.visibleIf !== undefined) ctx.useFormula(exit.visibleIf, room.id);
      if (exit.enabledIf !== undefined) ctx.useFormula(exit.enabledIf, room.id);
    }
  }
  // Fast travel can bring the reader back to any room, so none of them is unreachable.
  if (project.world?.fastTravel)
    for (const room of rooms) if (room.passage) ctx.jumps.add(room.passage);

  for (const { block, passage } of ctx.exitsBlocks)
    if (!owner.has(passage))
      report(
        'warning',
        'exits-outside',
        'This passage is not a room, so the Exits block has no exits to offer.',
        {},
        block.id,
      );

  for (const space of project.spaces ?? []) {
    unique(space.id, space.id);
    if (space.kind === 'map' && rooms.length === 0)
      report(
        'warning',
        'space-map-empty',
        'A map space shows nothing: the story has no rooms.',
        {},
        space.id,
      );
    if (space.kind !== 'screen') continue;
    const screen = project.screens?.find((s) => s.id === space.screen);
    if (!space.screen)
      report('error', 'unknown-screen', 'Pick the screen this space shows.', {}, space.id);
    else if (!screen)
      report(
        'error',
        'unknown-screen',
        `"${space.screen}" isn't a screen.`,
        { id: space.screen },
        space.id,
      );
    else if (screen.kind !== 'panel')
      report(
        'warning',
        'space-screen-kind',
        'A space shows a panel screen; title screens and HUDs belong elsewhere.',
        {},
        space.id,
      );
  }
}
