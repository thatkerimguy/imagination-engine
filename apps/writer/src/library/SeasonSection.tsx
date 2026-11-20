import type { ChapterDocument, SeasonManifest } from '@kn/core';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActionButton } from '../ui/ActionButton.tsx';
import { SectionLabel } from '../ui/Page.tsx';
import { PopoverMenu } from '../ui/PopoverMenu.tsx';
import { space } from '../ui/tokens.ts';
import { ChapterRow, type ChapterRowProps } from './ChapterRow.tsx';
import { InlineRename } from './InlineRename.tsx';

export interface SeasonSectionProps {
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

export function SeasonSection(p: SeasonSectionProps): ReactNode {
  const [editing, setEditing] = useState(false);
  const heading = `${p.sectionLabel} ${p.index + 1} · ${p.season.title}`;
  return (
    <View testID={`outline-season-${p.season.id}`}>
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
        <SectionLabel
          trailing={
            <PopoverMenu
              accessibilityLabel={`${p.sectionLabel} options`}
              items={[
                { label: 'Rename', icon: 'edit-2', onPress: () => setEditing(true) },
                {
                  label: 'Move up',
                  icon: 'arrow-up',
                  disabled: p.index === 0,
                  onPress: () => p.onMove(-1),
                },
                {
                  label: 'Move down',
                  icon: 'arrow-down',
                  disabled: p.index >= p.count - 1,
                  onPress: () => p.onMove(1),
                },
              ]}
            />
          }
        >
          {heading}
        </SectionLabel>
      )}
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
        <ActionButton
          label="New chapter"
          accessibilityLabel="Add chapter"
          icon="plus"
          variant="ghost"
          onPress={p.onAddChapter}
          testID={`add-chapter-${p.season.id}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  add: { alignItems: 'flex-start', paddingTop: space.xxs },
});
