// A novel as a literary book row on the shelf: cover, serif title, italic subtitle, quiet meta.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { BookCoverThumb } from '../components/BookCoverThumb.tsx';
import type { NovelSummary } from '../store/repository.ts';
import { Press } from '../ui/Press.tsx';
import { PopoverMenu, type MenuItem } from '../ui/PopoverMenu.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { countLabel, relativeTime } from './relative-time.ts';

export function NovelCard({
  novel,
  onOpen,
  onExport,
  onSettings,
  onDelete,
}: {
  novel: NovelSummary;
  onOpen(): void;
  onExport(): void;
  onSettings(): void;
  onDelete(): void;
}): ReactNode {
  const { colors } = useTheme();
  const { t, locale, formatNumber } = useI18n();
  const items: MenuItem[] = [
    {
      label: t('library.menu.export'),
      icon: 'share',
      onPress: onExport,
      testID: `novel-export-${novel.id}`,
    },
    {
      label: t('library.menu.settings'),
      icon: 'settings',
      onPress: onSettings,
      testID: `novel-settings-${novel.id}`,
    },
    {
      label: t('library.menu.trash'),
      icon: 'trash-2',
      destructive: true,
      onPress: onDelete,
      testID: `novel-delete-${novel.id}`,
    },
  ];
  const meta = [
    countLabel(novel.seasonCount, novel.sectionLabel.toLowerCase()),
    countLabel(novel.chapterCount, 'chapter'),
    t('library.words', { n: formatNumber(novel.words) }),
  ].join(' · ');
  const edited = t('library.edited', { when: relativeTime(novel.updatedAt, Date.now(), locale) });
  return (
    <View style={[styles.row, { borderColor: colors.hairline }]}>
      <Press
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={t('library.openNovel', { title: novel.title })}
        testID={`novel-card-${novel.id}`}
        style={styles.body}
      >
        <BookCoverThumb
          title={novel.title}
          {...(novel.accent ? { accent: novel.accent } : {})}
          {...(novel.coverUri ? { coverUri: novel.coverUri } : {})}
        />
        <View style={styles.text}>
          <Txt variant="heading" style={styles.title} numberOfLines={2}>
            {novel.title}
          </Txt>
          {novel.subtitle ? (
            <Txt variant="body" color="inkSecondary" style={styles.italic} numberOfLines={1}>
              {novel.subtitle}
            </Txt>
          ) : null}
          <Txt variant="meta" color="inkMuted" numberOfLines={1}>
            {meta}
          </Txt>
          <Txt
            variant="meta"
            color="inkMuted"
            numberOfLines={1}
            testID={`novel-edited-${novel.id}`}
          >
            {edited}
          </Txt>
        </View>
      </Press>
      <PopoverMenu
        items={items}
        accessibilityLabel={`${novel.title} options`}
        testID={`novel-menu-${novel.id}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  body: { flex: 1, flexDirection: 'row', gap: space.md, paddingVertical: space.md },
  text: { flex: 1, gap: 3, justifyContent: 'center' },
  title: { fontSize: 19, lineHeight: 24 },
  italic: { fontStyle: 'italic' },
});
