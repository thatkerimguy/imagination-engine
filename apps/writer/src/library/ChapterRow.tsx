import type { ChapterDocument } from '@kn/core';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from '../ui/AppText.tsx';
import { StatusBadge, type BadgeTone } from '../ui/layout.tsx';
import { shape, space } from '../ui/m3-tokens.ts';
import { OverflowMenu } from '../ui/OverflowMenu.tsx';
import { StatePressable } from '../ui/StateLayer.tsx';
import { makeStyles, useTheme } from '../ui/theme.tsx';
import { InlineRename } from './InlineRename.tsx';

const TONE: Record<ChapterDocument['status'], BadgeTone> = {
  draft: 'neutral',
  unlisted: 'tertiary',
  published: 'primary',
};
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

export function ChapterRow(p: ChapterRowProps): ReactNode {
  const s = useStyles();
  const { m3 } = useTheme();
  const [editing, setEditing] = useState(false);
  const c = p.chapter;
  if (editing) {
    return (
      <View style={s.row}>
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
    <View style={s.row} testID={`outline-chapter-${c.id}`}>
      <StatePressable
        onPress={p.onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open ${c.title}`}
        layerColor={m3.onSurface}
        style={s.title}
      >
        <AppText variant="titleMedium" numberOfLines={2}>
          {c.title}
        </AppText>
      </StatePressable>
      <StatePressable
        onPress={p.onCycleStatus}
        accessibilityRole="button"
        accessibilityLabel={`Status ${c.status}, tap to change`}
        hitSlop={12}
        layerColor={m3.onSurface}
        testID={`chapter-status-${c.id}`}
      >
        <StatusBadge label={LABEL[c.status]} tone={TONE[c.status]} />
      </StatePressable>
      <OverflowMenu
        accessibilityLabel={`${c.title} options`}
        items={[
          { label: 'Rename', icon: 'edit', onPress: () => setEditing(true) },
          {
            label: 'Move up',
            icon: 'arrow-upward',
            disabled: p.isFirst,
            onPress: () => p.onMove(-1),
          },
          {
            label: 'Move down',
            icon: 'arrow-downward',
            disabled: p.isLast,
            onPress: () => p.onMove(1),
          },
        ]}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: t.m3.surfaceContainer,
    borderRadius: shape.medium,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    minHeight: 56,
  },
  title: { flex: 1, minHeight: 48, justifyContent: 'center' },
}));
