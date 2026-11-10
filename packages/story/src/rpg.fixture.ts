import { compileStory } from './compile.ts';
import { StoryRuntime } from './runtime.ts';
import type { Block, StoryProject } from './schema.ts';
import { plainText } from './text.ts';

/** Test fixtures shared by rpg.test.ts and logic.test.ts. */
let n = 0;
export const t = (en: string) => ({ id: `ln${++n}`, en, tr: en });
export const say = (text: string): Block => ({ id: `b${++n}`, type: 'narration', text: t(text) });
let ends = 0;
export const endBlock = (): Block => ({ id: `fin${++ends}`, type: 'end' });
export const num = (id: string, value = 0, extra: object = {}) => ({
  id,
  name: { en: id, tr: id },
  type: 'number' as const,
  default: value,
  ...extra,
});

export function rpg(blocks: Block[], extra: Partial<StoryProject> = {}): StoryProject {
  return {
    format: 'imagination.story',
    schemaVersion: 1,
    id: 'rpg',
    title: { en: 'RPG', tr: 'RPG' },
    languages: ['en', 'tr'],
    start: 'start',
    variables: [
      num('gold', 20, { min: 0 }),
      num('hp', 30, { min: 0 }),
      num('maxHp', 30),
      num('atk', 8),
      num('def', 2),
      num('mp', 5),
      num('xp'),
      num('level', 1),
    ],
    characters: [],
    chapters: [{ id: 'c1', title: { en: 'One', tr: 'Bir' }, passages: [{ id: 'start', blocks }] }],
    items: [
      {
        id: 'potion',
        name: { en: 'Potion', tr: 'İksir' },
        kind: 'consumable',
        price: 6,
        effects: [{ var: 'hp', amount: 10 }],
      },
      { id: 'key', name: { en: 'Key', tr: 'Anahtar' }, kind: 'key' },
    ],
    quests: [
      {
        id: 'lost',
        name: { en: 'Lost', tr: 'Kayıp' },
        steps: [
          { id: 'find', text: { en: 'Find it', tr: 'Bul' } },
          { id: 'bring', text: { en: 'Bring it', tr: 'Getir' } },
        ],
      },
    ],
    hero: { hp: 'hp', maxHp: 'maxHp', attack: 'atk', defense: 'def', mp: 'mp' },
    skills: [
      { id: 'heal', name: { en: 'Heal', tr: 'Şifa' }, cost: 2, heal: true, power: 0.5 },
      { id: 'smite', name: { en: 'Smite', tr: 'Darbe' }, cost: 3, power: 2 },
      { id: 'secret', name: { en: 'Secret', tr: 'Sır' }, requires: 'level >= 5' },
    ],
    enemies: [
      {
        id: 'rat',
        name: { en: 'Rat', tr: 'Sıçan' },
        hp: 20,
        attack: 4,
        moves: [{ id: 'm1', name: { en: 'Bite', tr: 'Isır' }, pattern: 'jab', answer: 'parry' }],
      },
    ],
    ...extra,
  };
}

export const run = (project: StoryProject, seed = 7) => {
  const story = compileStory(project);
  return new StoryRuntime(story, { seed });
};

export const lines = (rt: StoryRuntime) =>
  rt.log.flatMap((beat) => {
    if (beat.kind !== 'line') return [];
    const block = rt.story.blocks.get(beat.blockId)?.block;
    return block?.type === 'narration' ? [plainText(rt.render(block.text, 'en', beat.values))] : [];
  });

/** Advances through lines until something other than a line waits. */
export function playOn(rt: StoryRuntime): void {
  for (let i = 0; i < 100; i++) {
    rt.advance();
    if (rt.waiting?.kind !== 'line' && rt.waiting?.kind !== 'pause') return;
  }
}
