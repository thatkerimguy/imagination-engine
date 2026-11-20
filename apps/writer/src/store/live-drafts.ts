// In-memory copy of the chapter being edited, including unsaved keystrokes, so the Live
// Preview screen can show exactly what is on the Author's screen right now.
import type { ChapterDocument } from '@kn/core';

const drafts = new Map<string, ChapterDocument>();

export const draftKey = (novelId: string, seasonId: string, chapterId: string): string =>
  `${novelId}/${seasonId}/${chapterId}`;

export const setLiveDraft = (key: string, chapter: ChapterDocument): void =>
  void drafts.set(key, chapter);

export const getLiveDraft = (key: string): ChapterDocument | undefined => drafts.get(key);

export const clearLiveDraft = (key: string): void => void drafts.delete(key);
