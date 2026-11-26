// Mode-aware wiring shared by ChapterEditor and NoteEditor: capability flags, toolbar tools the
// mode hides, prose-run edits (coalesced in undo history like typing) and native-surface routing.
import { useCallback, useMemo } from 'react';
import type { Block } from '@kn/core';
import type { ChapterDraft } from '../store/use-chapter-draft.ts';
import type { ToolId } from '../store/writer-prefs.ts';
import { workspaceCapabilities, type EditorMode } from '../workspace/mode-policy.ts';
import type { RunSegment } from './ProseRun.tsx';
import { applyRunEdit } from './prose-runs.ts';
import { useEditorActions } from './use-editor-actions.ts';
import { useFormatActions } from './use-format-actions.ts';
import { useSurfaceTools } from './use-surface-tools.ts';

export function useUnifiedEditing(input: {
  mode: EditorMode;
  update: ChapterDraft['update'];
  hiddenTools: readonly ToolId[];
  selectedId: string | null;
  onTool(id: ToolId): void;
  active: Partial<Record<ToolId, boolean>>;
}) {
  const { mode, update } = input;
  const caps = workspaceCapabilities(mode);
  const hiddenTools = useMemo<ToolId[]>(() => {
    const extra: ToolId[] = [];
    if (!caps.cues) extra.push('addGimmick');
    if (!caps.dialogue) extra.push('addDialogue');
    return [...input.hiddenTools, ...extra];
  }, [input.hiddenTools, caps.cues, caps.dialogue]);
  const onRunChange = useCallback(
    (run: RunSegment, markdown: string) =>
      update((c) => ({ ...c, blocks: applyRunEdit(c.blocks, run, markdown) }), {
        kind: 'typing',
        blockId: run.id,
      }),
    [update],
  );
  const surface = useSurfaceTools({
    selectedId: input.selectedId,
    onTool: input.onTool,
    active: input.active,
  });
  return { caps, hiddenTools, onRunChange, ...surface };
}

/** Block actions + format actions + unified-editing wiring, as both editors need them. */
export function useEditorCore(i: {
  blocks: readonly Block[];
  draft: ChapterDraft;
  mode: EditorMode;
  hiddenTools: readonly ToolId[];
  defaultAlign: 'left' | 'center' | 'right';
}) {
  const { draft } = i;
  const a = useEditorActions(draft.update);
  const f = useFormatActions({
    blocks: i.blocks,
    styles: draft.styles,
    selectedId: a.selectedId,
    defaultAlign: i.defaultAlign,
    update: draft.update,
    updateStyles: draft.updateStyles,
    pick: a.pick,
  });
  const u = useUnifiedEditing({
    mode: i.mode,
    update: draft.update,
    hiddenTools: i.hiddenTools,
    selectedId: a.selectedId,
    onTool: f.onTool,
    active: f.active,
  });
  return { a, f, u };
}
