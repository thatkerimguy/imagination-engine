// The note editor's bottom sheets in one place. Each is mounted only while open (null otherwise),
// so a closed editor carries zero Modal / Sheet instances.
import type { Block } from '@kn/core';
import type { ReactNode } from 'react';
import type { DocumentMetrics } from '../analysis/metrics.ts';
import { ItemMetaSheet } from '../components/ItemMetaSheet.tsx';
import { CommentSheet } from '../editor/EditorChrome.tsx';
import { MetricPickerSheet } from '../editor/MetricsRibbon.tsx';
import { OutlineSheet } from '../editor/OutlineSheet.tsx';
import type { BlockStyle } from '../store/chapter-styles.ts';
import { TextAnalysisSheet } from '../views/TextAnalysisSheet.tsx';
import { PromoteSheet } from './PromoteSheet.tsx';

export type NoteSheet = 'analysis' | 'outline' | 'metrics' | 'meta' | 'promote' | null;

export interface NoteSheetsProps {
  sheet: NoteSheet;
  setSheet(next: NoteSheet): void;
  commentOpen: boolean;
  onAddComment(text: string): void;
  onCloseComment(): void;
  docId: string;
  title: string;
  blocks: Block[];
  styles: Record<string, BlockStyle>;
  metrics: DocumentMetrics;
  jump(blockId: string): void;
  onPromote(novelId: string, seasonId: string): void;
}

export function NoteSheets(p: NoteSheetsProps): ReactNode {
  const close = (): void => p.setSheet(null);
  return (
    <>
      {p.sheet === 'analysis' ? (
        <TextAnalysisSheet
          visible
          blocks={p.blocks}
          typing={{ cpm: p.metrics.typingCpm, wpm: p.metrics.typingWpm }}
          onClose={close}
        />
      ) : null}
      {p.sheet === 'outline' ? (
        <OutlineSheet visible blocks={p.blocks} styles={p.styles} onJump={p.jump} onClose={close} />
      ) : null}
      {p.sheet === 'metrics' ? <MetricPickerSheet visible onClose={close} /> : null}
      {p.commentOpen ? (
        <CommentSheet visible onAdd={p.onAddComment} onClose={p.onCloseComment} />
      ) : null}
      {p.sheet === 'meta' ? (
        <ItemMetaSheet visible itemId={p.docId} title={p.title} onClose={close} />
      ) : null}
      {p.sheet === 'promote' ? (
        <PromoteSheet
          visible
          noteTitle={p.title}
          onClose={close}
          onPick={(novelId, seasonId) => {
            close();
            p.onPromote(novelId, seasonId);
          }}
        />
      ) : null}
    </>
  );
}
