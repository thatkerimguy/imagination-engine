// One hairline row of the Notes workspace: colour rail, optional cover thumb, title with tiny
// pin / lock glyphs, muted #tags and meta, and the per-item ⋯ menu.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { CoverImage } from '../components/CoverImage.tsx';
import { useI18n } from '../i18n/I18nProvider.tsx';
import type { Locale } from '../i18n/i18n.ts';
import { relativeTime } from '../library/relative-time.ts';
import type { ItemMeta } from '../store/item-meta.ts';
import { isRedacted } from '../store/unlock-session.ts';
import { Glyph } from '../ui/Glyph.tsx';
import { PopoverMenu, type MenuItem } from '../ui/PopoverMenu.tsx';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { radius, space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { KIND_META } from './kind-meta.ts';
import type { NoteItem } from './use-notes-data.ts';

export function itemMetaLine(item: NoteItem, locale: Locale = 'en', now = Date.now()): string {
  const when = relativeTime(item.updatedAt, now, locale);
  if (item.kind === 'folder') {
    const n = item.count ?? 0;
    return `${n} ${n === 1 ? 'item' : 'items'} · ${when}`;
  }
  const w = item.words ?? 0;
  return `${w.toLocaleString('en-US')} ${w === 1 ? 'word' : 'words'} · ${when}`;
}

export interface NoteRowProps {
  item: NoteItem;
  meta: ItemMeta | undefined;
  menu: readonly MenuItem[];
  onOpen(): void;
}

export function NoteRow({ item, meta, menu, onOpen }: NoteRowProps): ReactNode {
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const redacted = isRedacted(item.id, meta);
  const prefix = item.kind === 'folder' ? 'folder' : 'doc';
  return (
    <View
      style={[styles.row, { borderBottomColor: colors.hairline }]}
      testID={`${prefix}-row-${item.id}`}
    >
      <View
        style={[styles.rail, { backgroundColor: meta?.color ?? 'transparent' }]}
        accessible={false}
      />
      <Press
        accessibilityRole="button"
        accessibilityLabel={`${t(item.kind === 'folder' ? 'kind.folder' : KIND_META[item.storyKind ?? 'note'].labelKey)} ${item.title}`}
        onPress={onOpen}
        style={styles.body}
        testID={`${prefix}-open-${item.id}`}
      >
        {meta?.coverUri && !redacted ? (
          <CoverImage uri={meta.coverUri} style={styles.cover} />
        ) : (
          <Glyph
            name={item.kind === 'folder' ? 'folder' : KIND_META[item.storyKind ?? 'note'].icon}
            size={18}
            color="inkMuted"
          />
        )}
        <View style={styles.text}>
          <View style={styles.titleRow}>
            <Txt variant="body" numberOfLines={1} style={styles.title}>
              {item.title}
            </Txt>
            {meta?.pinned ? <Glyph name="bookmark" size={12} color="inkMuted" /> : null}
            {meta?.locked ? <Glyph name="lock" size={12} color="inkMuted" /> : null}
            {item.storyKind && item.storyKind !== 'note' ? (
              <View style={styles.pill} testID={`kind-pill-${item.id}`}>
                <Glyph name={KIND_META[item.storyKind].icon} size={10} color="inkMuted" />
                <Txt variant="caption" color="inkMuted">
                  {t(KIND_META[item.storyKind].labelKey)}
                </Txt>
              </View>
            ) : null}
          </View>
          <Txt variant="meta" color="inkMuted" numberOfLines={1}>
            {redacted ? t('notes.locked') : itemMetaLine(item, locale)}
          </Txt>
          {meta?.tags.length && !redacted ? (
            <Txt variant="caption" color="inkMuted" numberOfLines={1}>
              {meta.tags.map((t) => `#${t}`).join('  ')}
            </Txt>
          ) : null}
        </View>
      </Press>
      <PopoverMenu
        items={menu}
        accessibilityLabel={t('notes.actionsFor', { title: item.title })}
        testID={`item-menu-${item.id}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  rail: { width: 3, alignSelf: 'stretch', marginVertical: space.xs, borderRadius: 2 },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 56,
    paddingVertical: space.xs,
    paddingLeft: space.sm,
  },
  cover: { width: 32, height: 44, borderRadius: radius.xs },
  text: { flex: 1, gap: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
  title: { flexShrink: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 3, marginLeft: space.xxs },
});
