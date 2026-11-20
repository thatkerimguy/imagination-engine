// One search hit: kind glyph, title, muted subtitle and an excerpt with highlighted spans.
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Glyph, type GlyphName } from '../ui/Glyph.tsx';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import type { SearchKind, SearchResult } from './search-index.ts';

const GLYPH: Record<SearchKind, GlyphName> = {
  novel: 'book',
  chapter: 'file-text',
  folder: 'folder',
  doc: 'edit-3',
};

/** Splits `text` into [plain, highlighted, plain…] pieces. Pure. */
export function splitHighlights(
  text: string,
  spans: ReadonlyArray<readonly [number, number]>,
): Array<{ text: string; hit: boolean }> {
  const out: Array<{ text: string; hit: boolean }> = [];
  let at = 0;
  for (const [a, b] of spans) {
    if (a > at) out.push({ text: text.slice(at, a), hit: false });
    out.push({ text: text.slice(a, b), hit: true });
    at = b;
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: false });
  return out;
}

export function SearchResultRow(p: {
  result: SearchResult;
  onOpen(): void;
  last?: boolean;
  testID: string;
}): ReactNode {
  const { colors } = useTheme();
  const r = p.result;
  const hl = (text: string, spans: ReadonlyArray<readonly [number, number]>): ReactNode =>
    splitHighlights(text, spans).map((s, i) =>
      s.hit ? (
        <Text key={i} style={{ backgroundColor: colors.accentSoft, color: colors.ink }}>
          {s.text}
        </Text>
      ) : (
        s.text
      ),
    );
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={`${r.title}, ${r.subtitle}`}
      onPress={p.onOpen}
      testID={p.testID}
      style={[styles.row, !p.last && { borderBottomWidth: 1, borderColor: colors.hairline }]}
    >
      <Glyph name={r.locked ? 'lock' : GLYPH[r.kind]} size={18} color="inkMuted" />
      <View style={styles.text}>
        <Txt variant="body" numberOfLines={1}>
          {hl(r.title, r.titleHighlights)}
        </Txt>
        <Txt variant="meta" color="inkMuted" numberOfLines={1}>
          {r.subtitle}
        </Txt>
        {r.excerpt ? (
          <Txt variant="meta" color="inkSecondary" numberOfLines={3}>
            {hl(r.excerpt, r.highlights)}
          </Txt>
        ) : null}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, paddingVertical: space.sm, alignItems: 'flex-start' },
  text: { flex: 1, gap: 2 },
});
