// The chapter editor's bottom sheets in one place (analysis, outline, layout, metrics, comment,
// gimmick picker / gimmick settings, version history), so ChapterEditor stays a thin layout.
import type { ChapterDocument } from '@kn/core';
import type { ReactNode } from 'react';
import type { DocumentMetrics } from '../analysis/metrics.ts';
import { enabledWriterModules, getWriterModule } from '../modules/registry.ts';
import type { ChapterDraft } from '../store/use-chapter-draft.ts';
import { TextAnalysisSheet } from '../views/TextAnalysisSheet.tsx';
import { CommentSheet } from './EditorChrome.tsx';
import { GimmickBlockSheet } from './GimmickBlockSheet.tsx';
import { GimmickPicker } from './InsertSheets.tsx';
import { LayoutPrefsSheet } from './LayoutPrefsSheet.tsx';
import { MetricPickerSheet } from './MetricsRibbon.tsx';
import { OutlineSheet } from './OutlineSheet.tsx';
import type { useEditorActions } from './use-editor-actions.ts';
import type { useFormatActions } from './use-format-actions.ts';

export type EditorSheet = 'analysis' | 'outline' | 'layout' | 'metrics' | 'versions' | null;

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
  return (
    <>
      <TextAnalysisSheet
        visible={p.sheet === 'analysis'}
        blocks={chapter.blocks}
        typing={{ cpm: p.metrics.typingCpm, wpm: p.metrics.typingWpm }}
        onClose={close}
      />
      <OutlineSheet
        visible={p.sheet === 'outline'}
        blocks={chapter.blocks}
        styles={draft.styles}
        onJump={p.jump}
        onClose={close}
      />
      <LayoutPrefsSheet
        visible={p.sheet === 'layout'}
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
      <MetricPickerSheet visible={p.sheet === 'metrics'} onClose={close} />
      <CommentSheet visible={f.commentOpen} onAdd={f.addComment} onClose={f.closeComment} />
      <GimmickPicker
        visible={a.pickerOpen}
        modules={enabledWriterModules(p.enabledModules)}
        onPick={a.pickModule}
        onClose={a.closePicker}
      />
      {sheetBlock?.kind === 'module' && sheetModule ? (
        <GimmickBlockSheet
          block={sheetBlock}
          module={sheetModule}
          enabledModules={p.enabledModules}
          update={draft.update}
          onDone={() => a.openSheet(null)}
        />
      ) : null}
    </>
  );
}
