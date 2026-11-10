import { LOCALES, type Locale } from '@ie/i18n';
import { z } from 'zod';
import { audioLibrarySchema, type AudioLibrary } from './audio.ts';
import { enemySchema, type EnemyDef } from './fight.ts';
import { logicSchemas, type RoutineDef, type RuleDef } from './logic.ts';
import {
  heroSchema,
  itemSchema,
  questSchema,
  skillSchema,
  type HeroDef,
  type ItemDef,
  type QuestDef,
  type SkillDef,
} from './rpg.ts';
import {
  blockSchema,
  chapterSchema,
  characterSchema,
  idSchema,
  labelSchema,
  LAYOUTS,
  variableSchema,
  type Block,
  type Chapter,
  type CharacterDef,
  type Label,
  type Layout,
  type VariableDef,
} from './schema.ts';

const logic = logicSchemas((): z.ZodType<readonly Block[]> => z.array(blockSchema));

export const STORY_FORMAT = 'imagination.story';
export const STORY_SCHEMA_VERSION = 1;

export interface StoryProject {
  readonly format: typeof STORY_FORMAT;
  readonly schemaVersion: typeof STORY_SCHEMA_VERSION;
  readonly id: string;
  readonly title: Label;
  readonly author?: string;
  readonly languages: readonly Locale[];
  readonly start: string;
  readonly layout?: Layout;
  readonly variables: readonly VariableDef[];
  readonly characters: readonly CharacterDef[];
  readonly chapters: readonly Chapter[];
  readonly audio?: AudioLibrary;
  readonly enemies?: readonly EnemyDef[];
  readonly items?: readonly ItemDef[];
  readonly skills?: readonly SkillDef[];
  readonly quests?: readonly QuestDef[];
  readonly hero?: HeroDef;
  readonly rules?: readonly RuleDef[];
  readonly routines?: readonly RoutineDef[];
}
export const storyProjectSchema = z.object({
  format: z.literal(STORY_FORMAT),
  schemaVersion: z.literal(STORY_SCHEMA_VERSION),
  id: idSchema,
  title: labelSchema,
  author: z.string().optional(),
  languages: z.array(z.enum(LOCALES)).min(1),
  start: idSchema,
  layout: z.enum(LAYOUTS).optional(),
  variables: z.array(variableSchema),
  characters: z.array(characterSchema),
  chapters: z.array(chapterSchema).min(1),
  audio: audioLibrarySchema.optional(),
  enemies: z.array(enemySchema).optional(),
  items: z.array(itemSchema).optional(),
  skills: z.array(skillSchema).optional(),
  quests: z.array(questSchema).optional(),
  hero: heroSchema.optional(),
  rules: z.array(logic.rule).optional(),
  routines: z.array(logic.routine).optional(),
});
