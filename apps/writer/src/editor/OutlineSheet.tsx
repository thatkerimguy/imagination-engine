// Chapter outline: headings, scene breaks and gimmick blocks; one tap jumps and closes.
import type { Block } from '@kn/core';
import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import type { ChapterStyles } from '../store/chapter-styles.ts';
import { AppText } from '../ui/AppText.tsx';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { Icon, type IconName } from '../ui/Icon.tsx';
import { space, TOUCH } from '../ui/m3-tokens.ts';
import { makeStyles } from '../ui/theme.tsx';
import { stripInlineMarkup } from './inline-markup.ts';

export interface OutlineSheetProps {
  visible: boolean;
  blocks: readonly Block[];
  styles: ChapterStyles;
  onJump(blockId: string): void;
  onClose(): void;
}

interface Entry {
  id: string;
  label: string;
  icon: IconName;
  level: number;
}

export function outlineEntries(blocks: readonly Block[], styles: ChapterStyles): Entry[] {
  const out: Entry[] = [];
  for (const b of blocks) {
    if (b.kind === 'prose') {
      const level = styles[b.id]?.heading;
      const label = stripInlineMarkup(b.text).trim();
      if (level && label) out.push({ id: b.id, label, icon: 'title', level });
    } else if (b.kind === 'scene-break') {
      const label = [b.label, b.timestamp].filter(Boolean).join(' · ') || 'Scene break';
      out.push({ id: b.id, label, icon: 'diamond', level: 1 });
    } else if (b.kind === 'module') {
      out.push({ id: b.id, label: b.moduleId, icon: 'auto-awesome', level: 1 });
    }
  }
  return out;
}

const useStyles = makeStyles(() => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: TOUCH },
}));

export function OutlineSheet(p: OutlineSheetProps): ReactNode {
  const s = useStyles();
  const entries = outlineEntries(p.blocks, p.styles);
  return (
    <BottomSheet visible={p.visible} title="Outline" onClose={p.onClose} testID="outline-sheet">
      {entries.length === 0 ? (
        <AppText color="onSurfaceVariant">
          Headings, scene breaks and gimmicks will appear here.
        </AppText>
      ) : null}
      {entries.map((e) => (
        <Pressable
          key={e.id}
          accessibilityRole="button"
          accessibilityLabel={e.label}
          testID={`outline-${e.id}`}
          onPress={() => {
            p.onJump(e.id);
            p.onClose();
          }}
          style={[s.row, { paddingLeft: (e.level - 1) * space.lg }]}
        >
          <Icon name={e.icon} size={20} />
          <AppText variant={e.level === 1 ? 'titleSmall' : 'bodyMedium'} numberOfLines={1}>
            {e.label}
          </AppText>
        </Pressable>
      ))}
    </BottomSheet>
  );
}
