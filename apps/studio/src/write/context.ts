import type { Locale } from '@ie/i18n';
import type { StoryProject } from '@ie/story';
import { createContext, useContext } from 'react';
import type { LocatedProblem } from '../project/problems.ts';
import type { Editor } from './edit.ts';

/** What every block editor needs, provided once by the Manuscript instead of drilled through. */
export interface WriteContext {
  readonly doc: StoryProject;
  readonly editor: Editor;
  /** The language being written. */
  readonly locale: Locale;
  readonly problems: ReadonlyMap<string, readonly LocatedProblem[]>;
}

export const WriteCtx = createContext<WriteContext | null>(null);

export function useWrite(): WriteContext {
  const ctx = useContext(WriteCtx);
  if (!ctx) throw new Error('Block editors need the Manuscript around them.');
  return ctx;
}

/** Asks the text field of a block to take focus after the next render (Enter, Backspace). */
export function focusBlock(blockId: string): void {
  setTimeout(() => {
    const field = document.querySelector<HTMLElement>(
      `[data-block-id="${CSS.escape(blockId)}"] .tf__input`,
    );
    if (!field) return;
    field.focus();
    const range = document.createRange();
    range.selectNodeContents(field);
    range.collapse(false);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
  }, 0);
}
