import chat from './chat.kit.json';
import gamebook from './gamebook.kit.json';
import { parseKit, type Kit } from './kit.ts';
import mystery from './mystery.kit.json';
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
export const KITS: readonly Kit[] = [visualNovel, gamebook, chat, mystery].map((raw) =>
  parseKit(raw as unknown),
);

export function findKit(id: string): Kit | undefined {
  return KITS.find((kit) => kit.id === id);
}
