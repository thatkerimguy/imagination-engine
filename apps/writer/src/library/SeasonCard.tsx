import type { ChapterDocument, SeasonManifest } from '@kn/core';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from '../ui/AppText.tsx';
import { Button } from '../ui/Button.tsx';
import { Card } from '../ui/layout.tsx';
import { space } from '../ui/m3-tokens.ts';
import { OverflowMenu } from '../ui/OverflowMenu.tsx';
import { ChapterRow, type ChapterRowProps } from './ChapterRow.tsx';
import { InlineRename } from './InlineRename.tsx';

export interface SeasonCardProps {
  season: SeasonManifest;
  chapters: ChapterDocument[];
  index: number;
  count: number;
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
    <Card variant="elevated" style={styles.card}>
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
            <AppText variant="titleMedium" style={styles.title}>
              {heading}
            </AppText>
            <OverflowMenu
              accessibilityLabel={`${p.sectionLabel} options`}
              items={[
                { label: 'Rename', icon: 'edit', onPress: () => setEditing(true) },
                {
                  label: 'Move up',
                  icon: 'arrow-upward',
                  disabled: p.index === 0,
                  onPress: () => p.onMove(-1),
                },
                {
                  label: 'Move down',
                  icon: 'arrow-downward',
                  disabled: p.index >= p.count - 1,
                  onPress: () => p.onMove(1),
                },
              ]}
            />
          </>
        )}
      </View>
      {p.chapters.map((c, i) => (
        <ChapterRow
          key={c.id}
          chapter={c}
          isFirst={i === 0}
          isLast={i === p.chapters.length - 1}
          {...p.chapterProps(c)}
        />
      ))}
      <View style={styles.add}>
        <Button
          label="Chapter"
          accessibilityLabel="Add chapter"
          icon="add"
          variant="tonal"
          onPress={p.onAddChapter}
          testID={`add-chapter-${p.season.id}`}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1 },
  add: { alignItems: 'flex-start' },
});
