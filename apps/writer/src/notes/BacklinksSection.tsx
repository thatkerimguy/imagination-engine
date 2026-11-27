// "Referenced in N places": a calm collapsible list of everything that links to a story-bible
// node through [[wikilinks]] or @mentions. Reactive to repository writes.
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { tn, translator, type Locale, type Translate } from '../i18n/i18n.ts';
import { useRepoQuery } from '../store/context.tsx';
import { listBacklinks, type Backlink } from '../store/backlinks.ts';
import { Glyph, type GlyphName } from '../ui/Glyph.tsx';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { isStoryKind, KIND_META } from './kind-meta.ts';

export { backlinkHref, useOpenBacklink } from './backlink-nav.ts';

export interface BacklinksSectionProps {
  targetId: string;
  onOpen(b: Backlink): void;
  defaultOpen?: boolean;
}

const iconOf = (b: Backlink): GlyphName =>
  isStoryKind(b.sourceKind) ? KIND_META[b.sourceKind].icon : 'bookmark';

export const backlinksHeader = (n: number, t?: Translate, locale: Locale = 'en'): string =>
  n === 0
    ? (t ?? translator(locale))('backlinks.none')
    : tn('backlinks.count', n, undefined, locale);

export function BacklinksSection({
  targetId,
  onOpen,
  defaultOpen,
}: BacklinksSectionProps): ReactNode {
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(defaultOpen ?? false);
  const q = useRepoQuery<Backlink[]>(`backlinks:${targetId}`, (r) => listBacklinks(r, targetId));
  const links = q.data ?? [];
  const empty = links.length === 0;
  return (
    <View testID="backlinks-section" style={[styles.wrap, { borderTopColor: colors.hairline }]}>
      <Press
        accessibilityRole="button"
        accessibilityState={{ expanded: open && !empty }}
        accessibilityLabel={backlinksHeader(links.length, t, locale)}
        onPress={() => setOpen((o) => !o)}
        disabled={empty}
        style={styles.head}
        testID="backlinks-toggle"
      >
        <Txt variant="meta" color={empty ? 'inkMuted' : 'inkSecondary'} style={styles.title}>
          {backlinksHeader(links.length, t, locale)}
        </Txt>
        {empty ? null : (
          <Glyph name={open ? 'chevron-up' : 'chevron-down'} size={16} color="inkMuted" />
        )}
      </Press>
      {open && !empty
        ? links.map((b) => (
            <Press
              key={b.sourceId}
              accessibilityRole="button"
              accessibilityLabel={t('backlinks.open', { title: b.sourceTitle })}
              onPress={() => onOpen(b)}
              style={styles.row}
              testID={`backlink-${b.sourceId}`}
            >
              <Glyph name={iconOf(b)} size={16} color="inkMuted" />
              <View style={styles.text}>
                <Txt variant="body" numberOfLines={1}>
                  {b.sourceTitle}
                  {b.parentBookTitle ? (
                    <Txt variant="meta" color="inkMuted">{`  ${b.parentBookTitle}`}</Txt>
                  ) : null}
                </Txt>
                {b.excerpt ? (
                  <Txt variant="caption" color="inkMuted" numberOfLines={2}>
                    {b.excerpt}
                  </Txt>
                ) : null}
              </View>
            </Press>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: space.md },
  head: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: space.xs },
  title: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: space.xs },
  text: { flex: 1, gap: 1 },
});
