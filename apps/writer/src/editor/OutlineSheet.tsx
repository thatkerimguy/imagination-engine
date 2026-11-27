// Chapter outline: headings, scene breaks and gimmick blocks; one tap jumps and closes.
import type { Block } from '@kn/core';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { engineGlyph } from '../gimmicks/engine-look.ts';
import { isV2Cue } from '../gimmicks/cue.ts';
import { moduleOutlineLabel } from '../modules/registry.ts';
import type { ChapterStyles } from '../store/chapter-styles.ts';
import { Glyph, type GlyphName } from '../ui/Glyph.tsx';
import { Press } from '../ui/Press.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space, TOUCH } from '../ui/tokens.ts';
import { gimmickGlyph } from './gimmick-look.ts';
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
  icon: GlyphName;
  level: number;
}

export function outlineEntries(blocks: readonly Block[], styles: ChapterStyles): Entry[] {
  const out: Entry[] = [];
  for (const b of blocks) {
    if (b.kind === 'prose') {
      const level = styles[b.id]?.heading;
      const label = stripInlineMarkup(b.text).trim();
      if (level && label) out.push({ id: b.id, label, icon: 'type', level });
    } else if (b.kind === 'scene-break') {
      const label = [b.label, b.timestamp].filter(Boolean).join(' · ') || 'Scene break';
      out.push({ id: b.id, label, icon: 'minus', level: 1 });
    } else if (b.kind === 'module') {
      const label = moduleOutlineLabel(b.moduleId, b.props);
      out.push({
        id: b.id,
        label,
        icon: isV2Cue(b.props) ? engineGlyph(b.moduleId) : gimmickGlyph(b.moduleId),
        level: 1,
      });
    }
  }
  return out;
}

export function OutlineSheet(p: OutlineSheetProps): ReactNode {
  const entries = outlineEntries(p.blocks, p.styles);
  return (
    <Sheet visible={p.visible} title="Outline" onClose={p.onClose} testID="outline-sheet">
      {entries.length === 0 ? (
        <Txt color="inkSecondary">Headings, scene breaks and gimmicks will appear here.</Txt>
      ) : null}
      <View>
        {entries.map((e) => (
          <Press
            key={e.id}
            accessibilityRole="button"
            accessibilityLabel={e.label}
            testID={`outline-${e.id}`}
            onPress={() => {
              p.onJump(e.id);
              p.onClose();
            }}
            style={[styles.row, { paddingLeft: (e.level - 1) * space.lg }]}
          >
            <Glyph name={e.icon} size={16} color="inkMuted" />
            <Txt
              variant={e.level === 1 ? 'bodyStrong' : 'body'}
              numberOfLines={1}
              style={styles.label}
            >
              {e.label}
            </Txt>
          </Press>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: TOUCH },
  label: { flex: 1 },
});
