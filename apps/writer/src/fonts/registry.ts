// Pure custom-font registry helpers (immutable; ids never change once issued).
import { ulid } from '@kn/core';
import type { CustomFont } from '../store/writer-prefs.ts';

export const newCustomFontId = (): string => `custom-font-${ulid()}`;

export const findFont = (list: readonly CustomFont[], id: string): CustomFont | undefined =>
  list.find((f) => f.id === id);

/** Appends; an existing id is never overwritten. */
export const addFont = (list: readonly CustomFont[], font: CustomFont): CustomFont[] =>
  findFont(list, font.id) ? [...list] : [...list, font];

export const removeFont = (list: readonly CustomFont[], id: string): CustomFont[] =>
  list.filter((f) => f.id !== id);
