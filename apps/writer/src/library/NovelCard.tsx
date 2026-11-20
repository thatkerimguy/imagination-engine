import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NovelSummary } from '../store/repository.ts';
import { AppText } from '../ui/AppText.tsx';
import { Card, IconBadge } from '../ui/layout.tsx';
import { space } from '../ui/m3-tokens.ts';
import { OverflowMenu, type MenuItem } from '../ui/OverflowMenu.tsx';
import { StatePressable } from '../ui/StateLayer.tsx';
import { useTheme } from '../ui/theme.tsx';
import { countLabel, relativeTime } from './relative-time.ts';

export function NovelCard({
  novel,
  onOpen,
  onExport,
  onDelete,
}: {
  novel: NovelSummary;
  onOpen(): void;
  onExport(): void;
  onDelete(): void;
}): ReactNode {
  const { colors } = useTheme();
  const items: MenuItem[] = [
    {
      label: 'Export JSON',
      icon: 'ios-share',
      onPress: onExport,
      testID: `novel-export-${novel.id}`,
    },
    {
      label: 'Delete',
      icon: 'delete',
      destructive: true,
      onPress: onDelete,
      testID: `novel-delete-${novel.id}`,
    },
  ];
  return (
    <Card style={styles.card}>
      <StatePressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open ${novel.title}`}
        testID={`novel-card-${novel.id}`}
        layerColor={colors.onSurface}
        style={styles.body}
      >
        <IconBadge glyph={(novel.title.trim()[0] ?? '?').toUpperCase()} tone="primary" />
        <View style={styles.text}>
          <AppText variant="titleLarge">{novel.title}</AppText>
          {novel.subtitle ? (
            <AppText variant="bodyMedium" style={styles.italic}>
              {novel.subtitle}
            </AppText>
          ) : null}
          <AppText variant="labelMedium" color="onSurfaceVariant">
            {novel.author} · {countLabel(novel.seasonCount, novel.sectionLabel)} ·{' '}
            {countLabel(novel.chapterCount, 'chapter')} · edited {relativeTime(novel.updatedAt)}
          </AppText>
        </View>
      </StatePressable>
      <View style={styles.menu}>
        <OverflowMenu
          items={items}
          accessibilityLabel={`${novel.title} options`}
          testID={`novel-menu-${novel.id}`}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, flexDirection: 'row', alignItems: 'flex-start', overflow: 'hidden' },
  body: { flex: 1, flexDirection: 'row', gap: space.md, padding: space.lg },
  text: { flex: 1, gap: 2 },
  italic: { fontStyle: 'italic' },
  menu: { paddingTop: space.sm, paddingRight: space.xs },
});
