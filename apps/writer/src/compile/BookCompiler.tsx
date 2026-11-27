// Book Compiler: a quiet print-shop desk — cover, contents, layout options and the export grid.
// One screen for both a novel and a Notes folder (see CompileSource).
import type { WorkspaceMode } from '@kn/core';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { GimmickMode } from '../export/book-model.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import type { StringKey } from '../i18n/i18n.ts';
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

const GIMMICK_VALUES: readonly GimmickMode[] = ['transcript', 'summary', 'omit'];
const modeKey = (m: GimmickMode): StringKey => `compile.mode.${m}`;
const hintKey = (m: GimmickMode): StringKey => `compile.modeHint.${m}`;

/** `mode` defaults to prose (notes folders have no workspace mode): no gimmick export controls. */
export function BookCompiler({
  source,
  mode = 'prose',
}: {
  source: CompileSource;
  mode?: WorkspaceMode;
}): ReactNode {
  const { t } = useI18n();
  const caps = workspaceCapabilities(mode);
  const gimmickOptions = GIMMICK_VALUES.map((value) => ({ value, label: t(modeKey(value)) }));
  const { state, toggleRow, moveRow, setOpt, changeCover, run, copyRoyalRoad } =
    useCompiler(source);
  if (state.loading) return null;
  if (state.missing) return <EmptyState icon="alert-circle" title={t('compile.notFound')} />;
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
      <SectionLabel>{t('compile.layout')}</SectionLabel>
      <View>
        <ListRow
          title={t('compile.titlePage')}
          trailing={
            <Toggle
              value={opts.titlePage}
              onValueChange={(v) => setOpt('titlePage', v)}
              accessibilityLabel={t('compile.titlePage')}
              testID="compile-title-page"
            />
          }
        />
        <ListRow
          title={t('compile.toc')}
          trailing={
            <Toggle
              value={opts.toc}
              onValueChange={(v) => setOpt('toc', v)}
              accessibilityLabel={t('compile.toc')}
              testID="compile-toc"
            />
          }
        />
        <ListRow
          title={t('compile.pageBreaks')}
          last
          trailing={
            <Toggle
              value={opts.pageBreaks}
              onValueChange={(v) => setOpt('pageBreaks', v)}
              accessibilityLabel={t('compile.pageBreaksA11y')}
              testID="compile-page-breaks"
            />
          }
        />
      </View>
      {caps.gimmickExportMode ? (
        <>
          <SectionLabel>{t('compile.gimmickMode')}</SectionLabel>
          <SegmentControl
            options={gimmickOptions}
            value={opts.gimmickMode}
            onChange={(v) => setOpt('gimmickMode', v)}
            accessibilityLabel={t('compile.gimmickMode')}
            testID="compile-gimmick-mode"
          />
          <Txt variant="meta" color="inkSecondary" style={styles.hint}>
            {t(hintKey(opts.gimmickMode))}
          </Txt>
        </>
      ) : null}
      <SectionLabel>{t('compile.export')}</SectionLabel>
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
