import { createId } from '@ie/core';
import type { Locale } from '@ie/i18n';
import { createFromKit, type Kit } from '@ie/kits';
import type { Label, StoryProject, ThemePreset } from '@ie/story';
import { UNTITLED } from '../messages.ts';
import { newProject } from './factory.ts';

/** The project the new-novel wizard's answers describe: a kit (or blank), a look, a name. */
export function wizardProject(
  kit: Kit | null,
  preset: ThemePreset,
  title: Label,
  languages: readonly Locale[],
  firstPassage: string,
): StoryProject {
  const named = title.en?.trim() || title.tr?.trim() ? title : UNTITLED;
  if (kit) return createFromKit(kit, { id: createId('n'), title: named, theme: preset, languages });
  return { ...newProject(named, firstPassage), languages, theme: { preset } };
}
