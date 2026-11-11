import type { Translator } from '@ie/i18n';
import type { StoryProblem, StoryProject } from '@ie/story';
import type { MessageKey } from '../messages.ts';
import { labelText } from '../write/edit.ts';

/** Problems about rooms, exits and spaces (ADR 0031) in the Studio's language, or undefined. */
export function worldProblem(
  t: Translator<MessageKey>,
  problem: StoryProblem,
  doc: StoryProject,
): string | undefined {
  const p = problem.params;
  const rooms = doc.world?.rooms ?? [];
  // The analyzer names rooms in English; show the Studio's own language where there is one.
  const named = (fallback: string | undefined) => {
    const room = rooms.find((r) => r.name.en === fallback || r.name.tr === fallback);
    return room ? labelText(room.name, t.locale, room.id) : (fallback ?? '');
  };
  switch (problem.code) {
    case 'room-passage':
      return t('problem.roomPassage', { name: named(p.name) });
    case 'room-passage-twice':
      return t('problem.roomPassageTwice', { name: named(p.name), other: named(p.other) });
    case 'room-overlap':
      return t('problem.roomOverlap', { name: named(p.name), other: named(p.other) });
    case 'exit-target':
      return t('problem.exitTarget');
    case 'unknown-room':
      return t('problem.unknownRoom', { name: p.id ?? '' });
    case 'exits-outside':
      return t('problem.exitsOutside');
    case 'space-map-empty':
      return t('problem.spaceMapEmpty');
    case 'space-screen-kind':
      return t('problem.spaceScreenKind');
    default:
      return undefined;
  }
}
