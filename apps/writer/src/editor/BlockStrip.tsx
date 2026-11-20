// Compact 34dp active-block strip: quiet monochrome glyphs shown only for the focused block —
// style (prose) or accent (dialogue) cycle, Beat toggle, move up / down, delete.
import type { Block } from '@kn/core';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Glyph } from '../ui/Glyph.tsx';
import { toggleFeedback, tapFeedback } from '../ui/haptics.ts';
import { IconBtn } from '../ui/IconBtn.tsx';
import { Press, slop } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import type { DialogueBlock, ProseBlock } from './block-types.ts';
import { cycleAccent } from './DialogueBlockEditor.tsx';

export interface BlockActionHandlers {
  onToggleBeat(id: string): void;
  onMove(id: string, delta: -1 | 1): void;
  onDelete(id: string): void;
}

type ProseStyle = NonNullable<ProseBlock['style']>;
const STYLES: readonly { value: ProseStyle; label: string }[] = [
  { value: 'body', label: 'Body' },
  { value: 'whisper', label: 'Whisper' },
  { value: 'emphasis', label: 'Emphasis' },
];

const BOX = 34;

function Cycle(p: {
  icon: 'type' | 'droplet';
  label: string;
  hint: string;
  onPress(): void;
  testID: string;
}): ReactNode {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={p.hint}
      onPress={() => {
        tapFeedback();
        p.onPress();
      }}
      hitSlop={slop(BOX)}
      testID={p.testID}
      style={styles.cycle}
    >
      <Glyph name={p.icon} size={16} color="inkSecondary" />
      {p.label ? (
        <Txt variant="caption" color="inkSecondary">
          {p.label}
        </Txt>
      ) : null}
    </Press>
  );
}

export function BlockStrip(
  p: { block: Block; onChange(block: Block): void } & BlockActionHandlers,
): ReactNode {
  const { block } = p;
  const on = !!block.beatStop;
  const prose = block.kind === 'prose' ? block : null;
  const current = prose?.style ?? 'body';
  const next = (): ProseStyle => {
    const i = STYLES.findIndex((s) => s.value === current);
    return STYLES[(i + 1) % STYLES.length]!.value;
  };
  return (
    <View style={styles.row} testID={`block-strip-${block.id}`}>
      {prose ? (
        <Cycle
          icon="type"
          label={STYLES.find((s) => s.value === current)?.label ?? 'Body'}
          hint="Cycle prose style"
          testID={`prose-style-${block.id}`}
          onPress={() => p.onChange({ ...prose, style: next() })}
        />
      ) : null}
      {block.kind === 'dialogue' ? (
        <Cycle
          icon="droplet"
          label=""
          hint="Cycle accent colour"
          testID={`accent-${block.id}`}
          onPress={() => p.onChange(cycleAccent(block as DialogueBlock))}
        />
      ) : null}
      <View style={styles.grow} />
      <IconBtn
        icon="pause"
        box={BOX}
        size={16}
        active={on}
        accessibilityLabel="Beat stop"
        testID={`beat-toggle-${block.id}`}
        onPress={() => {
          toggleFeedback(!on);
          p.onToggleBeat(block.id);
        }}
      />
      <IconBtn
        icon="arrow-up"
        box={BOX}
        size={16}
        accessibilityLabel="Move up"
        onPress={() => p.onMove(block.id, -1)}
      />
      <IconBtn
        icon="arrow-down"
        box={BOX}
        size={16}
        accessibilityLabel="Move down"
        onPress={() => p.onMove(block.id, 1)}
      />
      <IconBtn
        icon="trash-2"
        box={BOX}
        size={16}
        accessibilityLabel="Delete block"
        onPress={() => p.onDelete(block.id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', height: BOX, gap: 2 },
  grow: { flex: 1 },
  cycle: { flexDirection: 'row', alignItems: 'center', gap: 6, height: BOX, paddingRight: 8 },
});
