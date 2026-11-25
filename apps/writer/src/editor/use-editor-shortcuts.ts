// Hardware-keyboard shortcuts for the Chapter Editor, active only while its screen is focused (a
// Preview pushed on top never sees editor keys). Matching is the pure shortcuts.ts table; the
// platform bridge is shortcuts-bridge(.web).ts.
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import type { ChapterDraft } from '../store/use-chapter-draft.ts';
import type { ToolId } from '../store/writer-prefs.ts';
import { subscribeKeys } from './shortcuts-bridge';
import { matchShortcut, type ShortcutAction } from './shortcuts.ts';

export type ShortcutHandlers = Partial<Record<ShortcutAction, () => void>>;

/** Bold / Italic / Underline through the toolbar, plus the draft's undo, redo and flush. */
export function formatShortcuts(
  onTool: (id: ToolId) => void,
  draft: Pick<ChapterDraft, 'undo' | 'redo' | 'flush'>,
): ShortcutHandlers {
  return {
    bold: () => onTool('bold'),
    italic: () => onTool('italic'),
    underline: () => onTool('underline'),
    undo: draft.undo,
    redo: draft.redo,
    save: () => void draft.flush(),
  };
}

export function useEditorShortcuts(handlers: ShortcutHandlers): void {
  const latest = useRef(handlers);
  latest.current = handlers;
  useFocusEffect(
    useCallback(
      () =>
        subscribeKeys((input, mac) => {
          const action = matchShortcut(input, mac);
          const run = action ? latest.current[action] : undefined;
          if (!run) return false;
          run();
          return true;
        }),
      [],
    ),
  );
}
