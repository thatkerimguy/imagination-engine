import chat from './chat.kit.json';
import explorer from './explorer.kit.json';
import gamebook from './gamebook.kit.json';
import horror from './horror.kit.json';
import { parseKit, type Kit } from './kit.ts';
import kineticPoetry from './kinetic-poetry.kit.json';
import mystery from './mystery.kit.json';
import rhythmAction from './rhythm-action.kit.json';
import roguelite from './roguelite.kit.json';
import social from './social.kit.json';
import survival from './survival.kit.json';
import terminal from './terminal.kit.json';
import textRpg from './text-rpg.kit.json';
import visualNovel from './visual-novel.kit.json';

export {
  applyKit,
  createFromKit,
  kitSchema,
  parseKit,
  type Kit,
  type KitContent,
  type NewProjectOptions,
} from './kit.ts';

/** The starter kits, in the order the new-project wizard shows them. Validated on load. */
export const KITS: readonly Kit[] = [
  visualNovel,
  gamebook,
  chat,
  mystery,
  textRpg,
  rhythmAction,
  social,
  survival,
  roguelite,
  explorer,
  horror,
  terminal,
  kineticPoetry,
].map((raw) => parseKit(raw as unknown));

export function findKit(id: string): Kit | undefined {
  return KITS.find((kit) => kit.id === id);
}
