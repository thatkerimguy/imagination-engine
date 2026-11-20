import type { ChapterDocument } from '@kn/core';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../ui/Button.tsx';
import { Badge } from '../ui/layout.tsx';
import { colors, radius, space } from '../ui/legacy-theme.ts';
import { InlineRename } from './InlineRename.tsx';

const TONE = { draft: 'muted', unlisted: 'warn', published: 'ok' } as const;

export interface ChapterRowProps {
  chapter: ChapterDocument;
  onOpen(): void;
  onCycleStatus(): void;
  onMove(delta: -1 | 1): void;
  onRename(title: string): void;
}

export function ChapterRow(p: ChapterRowProps): ReactNode {
  const [editing, setEditing] = useState(false);
  const c = p.chapter;
  if (editing) {
    return (
      <View style={styles.row}>
        <InlineRename
          initial={c.title}
          label="Chapter title"
          testID={`rename-chapter-${c.id}`}
          onSave={(t) => {
            setEditing(false);
            p.onRename(t);
          }}
          onCancel={() => setEditing(false)}
        />
      </View>
    );
  }
  return (
    <View style={styles.row} testID={`outline-chapter-${c.id}`}>
      <Pressable
        onPress={p.onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open ${c.title}`}
        style={styles.title}
      >
        <Text style={styles.titleText} numberOfLines={2}>
          {c.title}
        </Text>
      </Pressable>
      <Pressable
        onPress={p.onCycleStatus}
        accessibilityRole="button"
        accessibilityLabel={`Status ${c.status}, tap to change`}
        hitSlop={8}
        testID={`chapter-status-${c.id}`}
      >
        <Badge label={c.status.toUpperCase()} tone={TONE[c.status]} />
      </Pressable>
      <View style={styles.tools}>
        <Button
          label="↑"
          compact
          variant="ghost"
          onPress={() => p.onMove(-1)}
          accessibilityLabel="Move up"
        />
        <Button
          label="↓"
          compact
          variant="ghost"
          onPress={() => p.onMove(1)}
          accessibilityLabel="Move down"
        />
        <Button label="Rename" compact variant="ghost" onPress={() => setEditing(true)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
  title: { minHeight: 32, justifyContent: 'center' },
  titleText: { color: colors.fg, fontSize: 16, fontWeight: '600' },
  tools: { flexDirection: 'row', gap: space.xs, alignSelf: 'flex-end' },
});
