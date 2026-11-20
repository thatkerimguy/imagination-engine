import type { ChapterDocument, SeasonManifest } from '@kn/core';
import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/layout.tsx';
import { colors, space } from '../ui/legacy-theme.ts';
import { ChapterRow, type ChapterRowProps } from './ChapterRow.tsx';
import { InlineRename } from './InlineRename.tsx';

export interface SeasonCardProps {
  season: SeasonManifest;
  chapters: ChapterDocument[];
  index: number;
  sectionLabel: string;
  onRename(title: string): void;
  onMove(delta: -1 | 1): void;
  onAddChapter(): void;
  chapterProps(chapter: ChapterDocument): Omit<ChapterRowProps, 'chapter'>;
}

export function SeasonCard(p: SeasonCardProps): ReactNode {
  const [editing, setEditing] = useState(false);
  const heading = `${p.sectionLabel} ${p.index + 1} · ${p.season.title}`;
  return (
    <Card style={styles.card}>
      <View testID={`outline-season-${p.season.id}`} style={styles.head}>
        {editing ? (
          <InlineRename
            initial={p.season.title}
            label={`${p.sectionLabel} title`}
            testID={`rename-season-${p.season.id}`}
            onSave={(t) => {
              setEditing(false);
              p.onRename(t);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <Text style={styles.title}>{heading}</Text>
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
          </>
        )}
      </View>
      {p.chapters.map((c) => (
        <ChapterRow key={c.id} chapter={c} {...p.chapterProps(c)} />
      ))}
      <Button
        label="+ Chapter"
        compact
        onPress={p.onAddChapter}
        testID={`add-chapter-${p.season.id}`}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  head: { gap: space.xs },
  title: { color: colors.fg, fontSize: 18, fontWeight: '700' },
  tools: { flexDirection: 'row', gap: space.xs, alignSelf: 'flex-end' },
});
