// One continuous prose run on a RichSurface. The run reports caret moves in run coordinates;
// this maps them onto (block id, offset in that block) so toolbar formatting, Story Bible
// mentions and find & replace keep working per block, and maps forced selections back.
import { memo, useCallback, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../ui/theme.tsx';
import { useEditorTypography } from '../ui/typography.ts';
import type { Selection } from './inline-edit.ts';
import { blockTextStyle, InlineRichText } from './InlineRichText.tsx';
import { locateInRun, PARA, paragraphStarts, type EditorSegment } from './prose-runs.ts';
import { RichSurface } from './RichSurface';
import type { ActiveFormats, RichSurfaceHandle } from './rich-surface-types.ts';

export type RunSegment = Extract<EditorSegment, { kind: 'prose-run' }>;

export interface ProseRunProps {
  run: RunSegment;
  /** The block under the caret when it sits in this run (gets the accent rail). */
  selectedId: string | null;
  autoFocus: boolean;
  samsungSafeIme?: boolean;
  /** Forced selection of one of the run's blocks, in that block's coordinates. */
  forcedBlockId?: string;
  forcedSel?: Selection;
  onRunChange(run: RunSegment, markdown: string): void;
  onSelect(blockId: string): void;
  onSelectionChange?(blockId: string, sel: Selection): void;
  onHandle(runId: string, handle: RichSurfaceHandle | null): void;
  onFocusRun(runId: string): void;
  onActiveFormats(formats: ActiveFormats): void;
}

/** Run offset → the block it falls in and the offset inside that block. Pure. */
export function toBlockSelection(
  run: RunSegment,
  sel: Selection,
): { blockId: string; sel: Selection } {
  if (run.single || run.blockIds.length === 1) return { blockId: run.blockIds[0]!, sel };
  const a = locateInRun(run.markdown, sel.start);
  const b = locateInRun(run.markdown, sel.end);
  const end =
    b.index === a.index ? b.local : (run.markdown.split('\n\n')[a.index]?.length ?? a.local);
  return { blockId: run.blockIds[a.index] ?? run.blockIds[0]!, sel: { start: a.local, end } };
}

/** A block-local selection → run coordinates (undefined when the block is not in the run). */
export function toRunSelection(
  run: RunSegment,
  blockId: string,
  sel: Selection,
): Selection | undefined {
  const i = run.blockIds.indexOf(blockId);
  if (i < 0) return undefined;
  const base = run.single ? 0 : (paragraphStarts(run.markdown)[i] ?? 0);
  return { start: base + sel.start, end: base + sel.end };
}

function ProseRunImpl(p: ProseRunProps): ReactNode {
  const typo = useEditorTypography();
  const { colors } = useTheme();
  const { run } = p;
  const forced = useMemo(
    () =>
      p.forcedBlockId && p.forcedSel
        ? toRunSelection(run, p.forcedBlockId, p.forcedSel)
        : undefined,
    // Only a NEW forced selection re-targets the caret; later typing must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [p.forcedBlockId, p.forcedSel],
  );
  const report = useCallback(
    (sel: Selection) => {
      const at = toBlockSelection(run, sel);
      p.onSelect(at.blockId);
      p.onSelectionChange?.(at.blockId, at.sel);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, p.onSelect, p.onSelectionChange],
  );
  const rest = useMemo(
    () => (
      <View style={{ gap: typo.lineHeight }}>
        {run.markdown
          .split(PARA)
          .map((text, i) =>
            text ? (
              <InlineRichText key={i} text={text} typography={typo} />
            ) : (
              <View key={i} style={{ height: typo.lineHeight }} />
            ),
          )}
      </View>
    ),
    [run.markdown, typo],
  );
  const inRun = p.selectedId !== null && run.blockIds.includes(p.selectedId);
  return (
    <View style={styles.run} testID={`run-${run.id}`}>
      {inRun ? (
        <View style={[styles.rail, { backgroundColor: colors.accent }]} pointerEvents="none" />
      ) : null}
      <RichSurface
        value={run.markdown}
        rest={rest}
        {...(forced ? { selection: forced } : null)}
        placeholder="Write…"
        autoFocus={p.autoFocus}
        samsungSafeIme={p.samsungSafeIme}
        minHeight={typo.lineHeight}
        textStyle={blockTextStyle(undefined, typo)}
        testID={`prose-text-${run.id}`}
        onChangeText={(md) => p.onRunChange(run, md)}
        onSelectionChange={report}
        onFocus={() => p.onFocusRun(run.id)}
        onActiveFormatsChange={p.onActiveFormats}
        onHandle={(h) => p.onHandle(run.id, h)}
      />
    </View>
  );
}

const sameRun = (a: RunSegment, b: RunSegment): boolean =>
  a === b ||
  (a.id === b.id &&
    a.markdown === b.markdown &&
    a.single === b.single &&
    a.blockIds.join() === b.blockIds.join());

/** Memoized by run content (segments are rebuilt per edit): typing re-renders that run only. */
export const ProseRun = memo(ProseRunImpl, (a, b) => {
  const keys = Object.keys(b) as (keyof ProseRunProps)[];
  return keys.every((k) => (k === 'run' ? sameRun(a.run, b.run) : a[k] === b[k]));
});

const styles = StyleSheet.create({
  run: { paddingVertical: 6 },
  rail: { position: 'absolute', left: -9, top: 6, bottom: 6, width: 2, borderRadius: 1 },
});
