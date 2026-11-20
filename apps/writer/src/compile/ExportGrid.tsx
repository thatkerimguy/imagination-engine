// The 2-column hairline export grid: Glyph + label + muted format hint per tile.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ExportFormat } from '../export/book-model.ts';
import { Glyph, type GlyphName } from '../ui/Glyph.tsx';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';

interface Tile {
  format: ExportFormat;
  label: string;
  hint: string;
  icon: GlyphName;
  testID: string;
}

export const TILES: readonly Tile[] = [
  {
    format: 'docx',
    label: 'DOCX',
    hint: 'Word document',
    icon: 'file-text',
    testID: 'export-docx',
  },
  {
    format: 'pdf',
    label: 'PDF Book',
    hint: 'Print-ready .pdf',
    icon: 'book-open',
    testID: 'export-pdf',
  },
  { format: 'md', label: 'Markdown', hint: '.md text', icon: 'hash', testID: 'export-md' },
  { format: 'html', label: 'HTML', hint: 'Standalone page', icon: 'code', testID: 'export-html' },
  { format: 'txt', label: 'TXT', hint: 'Plain text', icon: 'align-left', testID: 'export-txt' },
  {
    format: 'knbook',
    label: '.knbook',
    hint: 'Full backup of this book',
    icon: 'archive',
    testID: 'export-knbook',
  },
  {
    format: 'print',
    label: 'Print',
    hint: 'Send to a printer',
    icon: 'printer',
    testID: 'export-print',
  },
];

export function ExportGrid(p: {
  busy: ExportFormat | null;
  /** Formats unavailable for this source (e.g. `.knbook` for a folder). */
  disabled?: readonly ExportFormat[];
  onExport(format: ExportFormat): void;
}): ReactNode {
  const { colors } = useTheme();
  return (
    <View style={[styles.grid, { borderTopColor: colors.hairline }]}>
      {TILES.map((t, i) => {
        const off = p.busy !== null || p.disabled?.includes(t.format) === true;
        return (
          <Press
            key={t.format}
            accessibilityRole="button"
            accessibilityLabel={`Export ${t.label}`}
            accessibilityState={{ busy: p.busy === t.format, disabled: off }}
            disabled={off}
            onPress={() => p.onExport(t.format)}
            testID={t.testID}
            style={[
              styles.tile,
              { borderBottomColor: colors.hairline, borderRightColor: colors.hairline },
              i % 2 === 0 ? styles.ruled : null,
            ]}
          >
            <Glyph name={p.busy === t.format ? 'loader' : t.icon} size={20} color="ink" />
            <View style={styles.text}>
              <Txt variant="bodyStrong" numberOfLines={1}>
                {t.label}
              </Txt>
              <Txt variant="caption" color="inkMuted" numberOfLines={1}>
                {p.busy === t.format ? 'Preparing…' : t.hint}
              </Txt>
            </View>
          </Press>
        );
      })}
    </View>
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
