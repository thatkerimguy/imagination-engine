import type { ChapterDocument } from '@kn/core';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { MIN_TOUCH } from '../ui/a11y.ts';
import { Press } from '../ui/Press.tsx';
import { PopoverMenu } from '../ui/PopoverMenu.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { InlineRename } from './InlineRename.tsx';
import { chapterWords } from '../store/word-count.ts';

const LABEL = { draft: 'Draft', unlisted: 'Unlisted', published: 'Published' } as const;

export interface ChapterRowProps {
  chapter: ChapterDocument;
  onOpen(): void;
  onCycleStatus(): void;
  onMove(delta: -1 | 1): void;
  onRename(title: string): void;
  isFirst?: boolean;
  isLast?: boolean;
}

/** Published = filled accent dot, Unlisted = accent ring, Draft = muted ring. */
function StatusDot({ status }: { status: ChapterDocument['status'] }): ReactNode {
  const { colors } = useTheme();
  const tone = status === 'draft' ? colors.inkMuted : colors.accent;
  return (
    <View
      style={[
        styles.dot,
        { borderColor: tone, backgroundColor: status === 'published' ? tone : 'transparent' },
      ]}
    />
  );
}

export function ChapterRow(p: ChapterRowProps): ReactNode {
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const c = p.chapter;
  const words = chapterWords(c);
  const line = { borderColor: colors.hairline };
  if (editing) {
    return (
      <View style={[styles.row, line]}>
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
    <View style={[styles.row, line]} testID={`outline-chapter-${c.id}`}>
      <View style={styles.main}>
        <Press
          onPress={p.onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Open ${c.title}`}
          hitSlop={{ top: 10, bottom: 0 }}
          style={styles.title}
        >
          <Txt variant="heading" style={styles.titleText} numberOfLines={2}>
            {c.title}
          </Txt>
        </Press>
        <View style={styles.metaRow}>
          <Press
            onPress={p.onCycleStatus}
            accessibilityRole="button"
            accessibilityLabel={`Status ${c.status}, tap to change`}
            hitSlop={{ top: 0, bottom: 20, left: 8, right: 8 }}
            testID={`chapter-status-${c.id}`}
            style={styles.status}
          >
            <StatusDot status={c.status} />
            <Txt variant="meta" color="inkSecondary">
              {LABEL[c.status]}
            </Txt>
          </Press>
          <Txt variant="meta" color="inkMuted">
            {`${words.toLocaleString()} ${words === 1 ? 'word' : 'words'}`}
          </Txt>
        </View>
      </View>
      <PopoverMenu
        accessibilityLabel={`${c.title} options`}
        items={[
          { label: 'Rename', icon: 'edit-2', onPress: () => setEditing(true) },
          {
            label: 'Move up',
            icon: 'arrow-up',
            disabled: p.isFirst,
            onPress: () => p.onMove(-1),
          },
          {
            label: 'Move down',
            icon: 'arrow-down',
            disabled: p.isLast,
            onPress: () => p.onMove(1),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, minHeight: 64 },
  main: { flex: 1, paddingVertical: space.xs },
  title: { minHeight: 38, justifyContent: 'center' },
  titleText: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  status: {
    minWidth: MIN_TOUCH,
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
});
