// The 2 x 4 hairline export grid (Glyph + label + muted hint per tile) and a secondary card
// (copy Royal Road HTML, print) beneath it.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ExportFormat } from '../export/book-model.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import type { StringKey } from '../i18n/i18n.ts';
import { CardGroup } from '../ui/CardGroup.tsx';
import { Glyph, type GlyphName } from '../ui/Glyph.tsx';
import { ListRow, SectionLabel } from '../ui/Page.tsx';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';

interface Tile {
  format: ExportFormat;
  label: string;
  hintKey: StringKey;
  icon: GlyphName;
  testID: string;
}

/** Exactly eight tiles: 2 columns x 4 rows. Print lives in the secondary card. */
export const TILES: readonly Tile[] = [
  {
    format: 'docx',
    label: 'DOCX',
    hintKey: 'compile.fmt.docx',
    icon: 'file-text',
    testID: 'export-docx',
  },
  {
    format: 'epub',
    label: 'EPUB 3',
    hintKey: 'compile.fmt.epub',
    icon: 'book',
    testID: 'export-epub',
  },
  { format: 'pdf', label: '', hintKey: 'compile.fmt.pdf', icon: 'book-open', testID: 'export-pdf' },
  { format: 'md', label: 'Markdown', hintKey: 'compile.fmt.md', icon: 'hash', testID: 'export-md' },
  {
    format: 'html',
    label: 'HTML',
    hintKey: 'compile.fmt.html',
    icon: 'code',
    testID: 'export-html',
  },
  {
    format: 'royalroad',
    label: 'Royal Road',
    hintKey: 'compile.fmt.royalroad',
    icon: 'share-2',
    testID: 'export-royalroad',
  },
  {
    format: 'txt',
    label: 'TXT',
    hintKey: 'compile.fmt.txt',
    icon: 'align-left',
    testID: 'export-txt',
  },
  {
    format: 'knbook',
    label: '.knbook',
    hintKey: 'compile.fmt.knbook',
    icon: 'archive',
    testID: 'export-knbook',
  },
];

export function ExportGrid(p: {
  busy: ExportFormat | null;
  /** Formats unavailable for this source (e.g. `.knbook` for a folder). */
  disabled?: readonly ExportFormat[];
  onExport(format: ExportFormat): void;
  onCopyRoyalRoad?(): void;
}): ReactNode {
  const { colors } = useTheme();
  const { t } = useI18n();
  const printOff = p.busy !== null || p.disabled?.includes('print') === true;
  return (
    <>
      <View style={[styles.grid, { borderTopColor: colors.hairline }]}>
        {TILES.map((tile, i) => {
          const off = p.busy !== null || p.disabled?.includes(tile.format) === true;
          const label = tile.format === 'pdf' ? t('compile.fmt.pdfLabel') : tile.label;
          return (
            <Press
              key={tile.format}
              accessibilityRole="button"
              accessibilityLabel={t('compile.exportA11y', { format: label })}
              accessibilityState={{ busy: p.busy === tile.format, disabled: off }}
              disabled={off}
              onPress={() => p.onExport(tile.format)}
              testID={tile.testID}
              style={[
                styles.tile,
                { borderBottomColor: colors.hairline, borderRightColor: colors.hairline },
                i % 2 === 0 ? styles.ruled : null,
              ]}
            >
              <Glyph name={p.busy === tile.format ? 'loader' : tile.icon} size={20} color="ink" />
              <View style={styles.text}>
                <Txt variant="bodyStrong" numberOfLines={1}>
                  {label}
                </Txt>
                <Txt variant="caption" color="inkMuted">
                  {p.busy === tile.format ? t('compile.preparing') : t(tile.hintKey)}
                </Txt>
              </View>
            </Press>
          );
        })}
      </View>
      <SectionLabel>{t('compile.more')}</SectionLabel>
      <CardGroup testID="card-export-secondary">
        {p.onCopyRoyalRoad ? (
          <ListRow
            title={t('compile.copyRoyalRoad')}
            subtitle={t('compile.copyRoyalRoadSub')}
            icon="copy"
            last
            onPress={() => (p.busy === null ? p.onCopyRoyalRoad?.() : undefined)}
            testID="export-royalroad-copy"
          />
        ) : null}
        <ListRow
          title={t('compile.print')}
          subtitle={t('compile.printSub')}
          icon="printer"
          last
          onPress={() => (printOff ? undefined : p.onExport('print'))}
          testID="export-print"
        />
      </CardGroup>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1 },
  tile: {
    width: '50%',
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
  },
  ruled: { borderRightWidth: 1 },
  text: { flex: 1, gap: 2 },
});
