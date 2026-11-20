// The chapter editor's bottom sheets in one place (analysis, outline, layout, metrics, comment,
// gimmick picker / gimmick settings, version history), so ChapterEditor stays a thin layout.
import type { Block, ChapterDocument } from '@kn/core';
import type { ReactNode } from 'react';
import type { DocumentMetrics } from '../analysis/metrics.ts';
import { enabledWriterModules, getWriterModule } from '../modules/registry.ts';
import type { ChapterDraft } from '../store/use-chapter-draft.ts';
import { TextAnalysisSheet } from '../views/TextAnalysisSheet.tsx';
import { VersionHistorySheet } from '../views/VersionHistorySheet.tsx';
import { CommentSheet } from './EditorChrome.tsx';
import { GimmickBlockSheet } from './GimmickBlockSheet.tsx';
import { GimmickPicker } from './InsertSheets.tsx';
import { LayoutPrefsSheet } from './LayoutPrefsSheet.tsx';
import { MetricPickerSheet } from './MetricsRibbon.tsx';
import { OutlineSheet } from './OutlineSheet.tsx';
import { sheetsToMount, type EditorSheet } from './sheet-mount.ts';
import type { useEditorActions } from './use-editor-actions.ts';
import type { useFormatActions } from './use-format-actions.ts';

export type { EditorSheet };

export interface EditorSheetsProps {
  sheet: EditorSheet;
  setSheet(next: EditorSheet): void;
  chapter: ChapterDocument;
  draft: ChapterDraft;
  metrics: DocumentMetrics;
  jump(blockId: string): void;
  focusMode: boolean;
  setFocusMode(on: boolean): void;
  enabledModules: readonly string[];
  onAppearance(): void;
  actions: ReturnType<typeof useEditorActions>;
  format: ReturnType<typeof useFormatActions>;
}

export function EditorSheets(p: EditorSheetsProps): ReactNode {
  const { chapter, draft, actions: a, format: f } = p;
  const close = (): void => p.setSheet(null);
  const sheetBlock = chapter.blocks.find((b) => b.id === a.sheetId);
  const sheetModule =
    sheetBlock?.kind === 'module' ? getWriterModule(sheetBlock.moduleId) : undefined;
  const gimmickSheet = sheetBlock?.kind === 'module' && sheetModule ? sheetBlock : null;
  const open = new Set(
    sheetsToMount({
      sheet: p.sheet,
      commentOpen: f.commentOpen,
      pickerOpen: a.pickerOpen,
      gimmickSheetOpen: !!gimmickSheet,
    }),
  );
  return (
    <>
      {open.has('analysis') ? (
        <TextAnalysisSheet
          visible
          blocks={chapter.blocks}
          typing={{ cpm: p.metrics.typingCpm, wpm: p.metrics.typingWpm }}
          onClose={close}
        />
      ) : null}
      {open.has('outline') ? (
        <OutlineSheet
          visible
          blocks={chapter.blocks}
          styles={draft.styles}
          onJump={p.jump}
          onClose={close}
        />
      ) : null}
      {open.has('layout') ? (
        <LayoutPrefsSheet
          visible
          focusMode={p.focusMode}
          onFocusMode={(on) => {
            p.setFocusMode(on);
            if (on) close();
          }}
          onClose={close}
          onOpenAppearance={() => {
            close();
            p.onAppearance();
          }}
        />
      ) : null}
      {open.has('metrics') ? <MetricPickerSheet visible onClose={close} /> : null}
      {open.has('versions') ? (
        <VersionHistorySheet
          visible
          target={`chapter:${chapter.id}`}
          currentBlocks={chapter.blocks}
          onRestore={(blocks) => draft.update((c) => ({ ...c, blocks: blocks as Block[] }))}
          onClose={close}
        />
      ) : null}
      {open.has('comment') ? (
        <CommentSheet visible onAdd={f.addComment} onClose={f.closeComment} />
      ) : null}
      {open.has('picker') ? (
        <GimmickPicker
          visible
          modules={enabledWriterModules(p.enabledModules)}
          onPick={a.pickModule}
          onClose={a.closePicker}
        />
      ) : null}
      {gimmickSheet && sheetModule ? (
        <GimmickBlockSheet
          block={gimmickSheet}
          module={sheetModule}
          enabledModules={p.enabledModules}
          update={draft.update}
          onDone={() => a.openSheet(null)}
        />
      ) : null}
    </>
  );
}
