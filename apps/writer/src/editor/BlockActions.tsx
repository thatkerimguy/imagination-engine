import type { Block } from '@kn/core';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../ui/Button';
import { toggleFeedback } from '../ui/haptics.ts';
import { colors, radius, space } from '../ui/legacy-theme.ts';

export interface BlockActionHandlers {
  onToggleBeat(id: string): void;
  onMove(id: string, delta: -1 | 1): void;
  onInsertBelow(id: string): void;
  onDelete(id: string): void;
}

export function BlockActions(p: { block: Block } & BlockActionHandlers): ReactNode {
  const { block } = p;
  const on = !!block.beatStop;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: on }}
        onPress={() => {
          toggleFeedback(!on);
          p.onToggleBeat(block.id);
        }}
        testID={`beat-toggle-${block.id}`}
        style={[styles.beat, on && styles.beatOn]}
      >
        <Text style={[styles.beatText, on && styles.beatTextOn]}>
          {on ? '⏸ Beat stop: on' : 'Beat stop'}
        </Text>
      </Pressable>
      <Button
        compact
        label="↑"
        accessibilityLabel="Move up"
        onPress={() => p.onMove(block.id, -1)}
      />
      <Button
        compact
        label="↓"
        accessibilityLabel="Move down"
        onPress={() => p.onMove(block.id, 1)}
      />
      <Button compact label="+ Below" onPress={() => p.onInsertBelow(block.id)} />
      <Button compact variant="danger" label="Delete" onPress={() => p.onDelete(block.id)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  beat: {
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    justifyContent: 'center',
  },
  beatOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  beatText: { color: colors.fg, fontSize: 15, fontWeight: '600' },
  beatTextOn: { color: colors.accentInk },
});
