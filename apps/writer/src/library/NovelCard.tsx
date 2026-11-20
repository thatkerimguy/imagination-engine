import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NovelSummary } from '../store/repository.ts';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/layout.tsx';
import { colors, space } from '../ui/legacy-theme.ts';
import { countLabel, relativeTime } from './relative-time.ts';

export function NovelCard({
  novel,
  onOpen,
  onDelete,
}: {
  novel: NovelSummary;
  onOpen(): void;
  onDelete(): void;
}): ReactNode {
  return (
    <Card>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open ${novel.title}`}
        testID={`novel-card-${novel.id}`}
        style={styles.body}
      >
        <Text style={styles.title}>{novel.title}</Text>
        {novel.subtitle ? <Text style={styles.subtitle}>{novel.subtitle}</Text> : null}
        <Text style={styles.meta}>by {novel.author}</Text>
        <Text style={styles.meta}>
          {countLabel(novel.seasonCount, novel.sectionLabel)} ·{' '}
          {countLabel(novel.chapterCount, 'chapter')}
        </Text>
        <Text style={styles.meta}>Edited {relativeTime(novel.updatedAt)}</Text>
      </Pressable>
      <View style={styles.actions}>
        <Button
          label="Delete"
          variant="danger"
          compact
          onPress={onDelete}
          testID={`novel-delete-${novel.id}`}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  body: { gap: 2 },
  title: { color: colors.fg, fontSize: 20, fontWeight: '700' },
  subtitle: { color: colors.fg, fontSize: 15, fontStyle: 'italic' },
  meta: { color: colors.muted, fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: space.xs },
});
