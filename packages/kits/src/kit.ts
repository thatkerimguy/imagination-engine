import type { Locale } from '@ie/i18n';
import {
  LAYOUTS,
  STORY_FORMAT,
  STORY_SCHEMA_VERSION,
  THEME_PRESETS,
  labelSchema,
  storyProjectSchema,
  type Label,
  type Layout,
  type StoryProject,
  type ThemePreset,
} from '@ie/story';
import { z } from 'zod';

/*
 * Kits (ADR 0018): a genre as data. A kit names a theme and a layout and carries definitions
 * (variables, characters, items, quests, rules, screens) plus a short bilingual starter story.
 */

const content = storyProjectSchema
  .pick({
    start: true,
    variables: true,
    characters: true,
    chapters: true,
    items: true,
    skills: true,
    quests: true,
    enemies: true,
    hero: true,
    rules: true,
    routines: true,
    screens: true,
  })
  .partial({
    items: true,
    skills: true,
    quests: true,
    enemies: true,
    hero: true,
    rules: true,
    routines: true,
    screens: true,
  });

export const kitSchema = z.object({
  id: z.string().regex(/^[a-z][a-z-]*$/),
  name: labelSchema,
  blurb: labelSchema,
  theme: z.enum(THEME_PRESETS),
  layout: z.enum(LAYOUTS),
  project: content,
});

export type KitContent = z.infer<typeof content>;

export interface Kit {
  readonly id: string;
  readonly name: Label;
  readonly blurb: Label;
  /** The preset the wizard suggests; the creator can pick another. */
  readonly theme: ThemePreset;
  readonly layout: Layout;
  readonly project: KitContent;
}

/** Validates a raw kit document. Kits are data, so they're checked like any other file. */
export function parseKit(raw: unknown): Kit {
  return kitSchema.parse(raw);
}

export interface NewProjectOptions {
  readonly id: string;
  readonly title: Label;
  readonly theme: ThemePreset;
  readonly languages: readonly Locale[];
}

/** A new project from a kit: its definitions, screens and starter story, in the chosen look. */
export function createFromKit(kit: Kit, options: NewProjectOptions): StoryProject {
  const project: StoryProject = {
    format: STORY_FORMAT,
    schemaVersion: STORY_SCHEMA_VERSION,
    id: options.id,
    title: options.title,
    languages: options.languages,
    layout: kit.layout,
    theme: { preset: options.theme },
    kits: [kit.id],
    ...structuredClone(kit.project),
  };
  return storyProjectSchema.parse(project);
}

type Keyed = { readonly id: string };

function merge<T extends Keyed>(
  mine: readonly T[] | undefined,
  theirs: readonly T[] | undefined,
): T[] | undefined {
  if (!theirs?.length) return mine ? [...mine] : undefined;
  const have = new Set((mine ?? []).map((x) => x.id));
  return [...(mine ?? []), ...structuredClone(theirs).filter((x) => !have.has(x.id))];
}

/**
 * Mixes a kit into an existing project: definitions and screens whose IDs are new. The project's
 * own story, theme, layout and anything it already defines are kept.
 */
export function applyKit(project: StoryProject, kit: Kit): StoryProject {
  const k = kit.project;
  const next: StoryProject = {
    ...project,
    variables: merge(project.variables, k.variables) ?? [],
    characters: merge(project.characters, k.characters) ?? [],
    ...optional('items', merge(project.items, k.items)),
    ...optional('skills', merge(project.skills, k.skills)),
    ...optional('quests', merge(project.quests, k.quests)),
    ...optional('enemies', merge(project.enemies, k.enemies)),
    ...optional('rules', merge(project.rules, k.rules)),
    ...optional('routines', merge(project.routines, k.routines)),
    ...optional('screens', merge(project.screens, k.screens)),
    ...(project.hero || !k.hero ? {} : { hero: structuredClone(k.hero) }),
    kits: [...new Set([...(project.kits ?? []), kit.id])],
  };
  return next;
}

function optional<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}
