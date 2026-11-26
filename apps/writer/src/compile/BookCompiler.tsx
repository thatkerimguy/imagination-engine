// Book Compiler: a quiet print-shop desk — cover, contents, layout options and the export grid.
// One screen for both a novel and a Notes folder (see CompileSource).
import type { WorkspaceMode } from '@kn/core';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { GimmickMode } from '../export/book-model.ts';
import { ListRow, EmptyState, Page, SectionLabel } from '../ui/Page.tsx';
import { SegmentControl } from '../ui/SegmentControl.tsx';
import { Toggle } from '../ui/Toggle.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { workspaceCapabilities } from '../workspace/mode-policy.ts';
import { ChapterRows } from './ChapterRows.tsx';
import { CoverSlot } from './CoverSlot.tsx';
import { ExportGrid } from './ExportGrid.tsx';
import { useCompiler, type CompileSource } from './use-compiler.ts';

export type { CompileSource } from './use-compiler.ts';

const GIMMICK_OPTIONS = [
  { value: 'transcript', label: 'Transcript' },
  { value: 'summary', label: 'Summary' },
  { value: 'omit', label: 'Omit' },
] as const satisfies readonly { value: GimmickMode; label: string }[];

const GIMMICK_HINT: Record<GimmickMode, string> = {
  transcript: 'Gimmicks read as scene cues and dialogue lines.',
  summary: 'Each gimmick becomes one bracketed line.',
  omit: 'Gimmicks are left out of the printed book.',
};

/** `mode` defaults to prose (notes folders have no workspace mode): no gimmick export controls. */
export function BookCompiler({
  source,
  mode = 'prose',
}: {
  source: CompileSource;
  mode?: WorkspaceMode;
}): ReactNode {
  const caps = workspaceCapabilities(mode);
  const { state, toggleRow, moveRow, setOpt, changeCover, run, copyRoyalRoad } =
    useCompiler(source);
  if (state.loading) return null;
  if (state.missing) return <EmptyState icon="alert-circle" title="This item could not be found" />;
  const { opts } = state;
  return (
    <Page>
      <CoverSlot
        title={state.title}
        author={state.author}
        {...(state.coverUri ? { coverUri: state.coverUri } : {})}
        onPress={() => void changeCover()}
      />
      <ChapterRows rows={state.rows} onToggle={toggleRow} onMove={moveRow} />
      <SectionLabel>Layout</SectionLabel>
      <View>
        <ListRow
          title="Title page"
          trailing={
            <Toggle
              value={opts.titlePage}
              onValueChange={(v) => setOpt('titlePage', v)}
              accessibilityLabel="Title page"
              testID="compile-title-page"
            />
          }
        />
        <ListRow
          title="Table of contents"
          trailing={
            <Toggle
              value={opts.toc}
              onValueChange={(v) => setOpt('toc', v)}
              accessibilityLabel="Table of contents"
              testID="compile-toc"
            />
          }
        />
        <ListRow
          title="Page breaks between chapters"
          last
          trailing={
            <Toggle
              value={opts.pageBreaks}
              onValueChange={(v) => setOpt('pageBreaks', v)}
              accessibilityLabel="Page breaks"
              testID="compile-page-breaks"
            />
          }
        />
      </View>
      {caps.gimmickExportMode ? (
        <>
          <SectionLabel>Gimmick export mode</SectionLabel>
          <SegmentControl
            options={GIMMICK_OPTIONS}
            value={opts.gimmickMode}
            onChange={(v) => setOpt('gimmickMode', v)}
            accessibilityLabel="Gimmick export mode"
            testID="compile-gimmick-mode"
          />
          <Txt variant="meta" color="inkSecondary" style={styles.hint}>
            {GIMMICK_HINT[opts.gimmickMode]}
          </Txt>
        </>
      ) : null}
      <SectionLabel>Export</SectionLabel>
      <ExportGrid
        busy={state.busy}
        disabled={source.kind === 'folder' ? ['knbook'] : []}
        onExport={(f) => void run(f)}
        onCopyRoyalRoad={() => void copyRoyalRoad()}
      />
      {state.notice ? (
        <Txt
          variant="meta"
          color="inkSecondary"
          accessibilityLiveRegion="polite"
          testID="compile-notice"
        >
          {state.notice}
        </Txt>
      ) : null}
      {state.error ? (
        <Txt variant="meta" color="danger" accessibilityLiveRegion="polite" testID="compile-error">
          {state.error}
        </Txt>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({ hint: { marginTop: -space.xs } });
