// The unified editor stream shared by chapters and notes: consecutive plain prose blocks edit as
// one continuous RichSurface run (single tap = caret), interleaved with atomic dialogue,
// scene-break and — in Interactive Studio — cue cards. Classic Novel hides cues without ever
// dropping them (see prose-runs.ts). Rows are memoized with id-taking, ref-stable handlers.
import type { Block } from '@kn/core';
import { memo, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import type { ChapterStyles } from '../store/chapter-styles.ts';
import { EmptyState } from '../ui/Page.tsx';
import { BlockStrip } from './BlockStrip.tsx';
import { BlockView, type BlockViewProps } from './BlockView.tsx';
import type { ProseBlock } from './block-types.ts';
import type { Selection } from './inline-edit.ts';
import { ProseRun, type RunSegment } from './ProseRun.tsx';
import { blocksToSegments } from './prose-runs.ts';
import type { SurfaceTools } from './use-surface-tools.ts';

type RowHandlers = Pick<
  BlockViewProps,
  | 'onSelect'
  | 'onChange'
  | 'onOpenGimmick'
  | 'onToggleBeat'
  | 'onMove'
  | 'onDelete'
  | 'onSelectionChange'
>;

export interface UnifiedBlocksProps extends RowHandlers {
  blocks: readonly Block[];
  selectedId: string | null;
  focusId: string | null;
  enabledModules: readonly string[];
  styles: ChapterStyles;
  /** Interactive Studio shows cue cards; Classic Novel and notes keep them hidden (not dropped). */
  includeCues: boolean;
  samsungSafeIme?: boolean;
  emptyBody?: string;
  forcedSelection(blockId: string): Selection | undefined;
  onLayout(id: string, y: number): void;
  onRunChange(run: RunSegment, markdown: string): void;
  tools: SurfaceTools;
}

/** A prose block that keeps its own surface: block styles (heading, align, colour…) or a voice. */
export function isStandaloneProse(b: ProseBlock, styles: ChapterStyles): boolean {
  if (b.style && b.style !== 'body') return true;
  const s = styles[b.id];
  return !!s && Object.entries(s).some(([k, v]) => k !== 'raw' && v !== undefined);
}

const emptyBody = (cues: boolean): string =>
  `Use the toolbar below to add prose, dialogue${cues ? ', a scene break or a gimmick' : ' or a scene break'}.`;

const AtomicRow = memo(function AtomicRow({
  onLayout,
  ...p
}: BlockViewProps & { onLayout(id: string, y: number): void }): ReactNode {
  return (
    <View onLayout={(e) => onLayout(p.block.id, e.nativeEvent.layout.y)}>
      <BlockView {...p} />
    </View>
  );
});

export function UnifiedBlocks(p: UnifiedBlocksProps): ReactNode {
  const { blocks, styles, includeCues, tools } = p;
  const segments = useMemo(
    () =>
      blocksToSegments(blocks, { includeCues, standalone: (b) => isStandaloneProse(b, styles) }),
    [blocks, styles, includeCues],
  );
  const runs = useMemo(
    () => segments.filter((s): s is RunSegment => s.kind === 'prose-run'),
    [segments],
  );
  tools.setRuns(runs);

  if (blocks.length === 0)
    return (
      <EmptyState icon="edit-3" title="A blank page" body={p.emptyBody ?? emptyBody(includeCues)} />
    );
  return segments.map((seg) => {
    if (seg.kind === 'prose-run') {
      const forcedBlockId = seg.blockIds.find((id) => p.forcedSelection(id));
      const selected = p.selectedId && seg.blockIds.includes(p.selectedId) ? p.selectedId : null;
      const block = selected ? blocks.find((b) => b.id === selected) : undefined;
      return (
        <View
          key={seg.id}
          onLayout={(e) => seg.blockIds.forEach((id) => p.onLayout(id, e.nativeEvent.layout.y))}
        >
          <ProseRun
            run={seg}
            selectedId={selected}
            autoFocus={seg.blockIds.some((id) => id === p.focusId)}
            samsungSafeIme={p.samsungSafeIme}
            forcedBlockId={forcedBlockId}
            forcedSel={forcedBlockId ? p.forcedSelection(forcedBlockId) : undefined}
            onRunChange={p.onRunChange}
            onSelect={p.onSelect}
            onSelectionChange={p.onSelectionChange}
            onHandle={tools.onHandle}
            onFocusRun={tools.onFocusRun}
            onActiveFormats={tools.onActiveFormats}
          />
          {block ? (
            <BlockStrip
              block={block}
              onChange={p.onChange}
              onToggleBeat={p.onToggleBeat}
              onMove={p.onMove}
              onDelete={p.onDelete}
            />
          ) : null}
        </View>
      );
    }
    const b = seg.block;
    return (
      <AtomicRow
        key={seg.id}
        block={b}
        selected={p.selectedId === b.id}
        autoFocus={p.focusId === b.id}
        moduleEnabled={b.kind !== 'module' || p.enabledModules.includes(b.moduleId)}
        blockStyle={styles[b.id]}
        samsungSafeIme={p.samsungSafeIme}
        selection={p.forcedSelection(b.id)}
        onLayout={p.onLayout}
        onSelect={p.onSelect}
        onChange={p.onChange}
        onOpenGimmick={p.onOpenGimmick}
        onToggleBeat={p.onToggleBeat}
        onMove={p.onMove}
        onDelete={p.onDelete}
        onSelectionChange={p.onSelectionChange}
      />
    );
  });
}
