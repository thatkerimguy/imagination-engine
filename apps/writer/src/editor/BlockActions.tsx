import type { Block } from '@kn/core';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { toggleFeedback } from '../ui/haptics.ts';
import { IconButton } from '../ui/IconButton.tsx';

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
      <IconButton
        icon="pause-circle-outline"
        accessibilityLabel="Beat stop"
        selected={on}
        testID={`beat-toggle-${block.id}`}
        onPress={() => {
          toggleFeedback(!on);
          p.onToggleBeat(block.id);
        }}
      />
      <IconButton
        icon="arrow-upward"
        accessibilityLabel="Move up"
        onPress={() => p.onMove(block.id, -1)}
      />
      <IconButton
        icon="arrow-downward"
        accessibilityLabel="Move down"
        onPress={() => p.onMove(block.id, 1)}
      />
      <IconButton
        icon="playlist-add"
        accessibilityLabel="Insert below"
        onPress={() => p.onInsertBelow(block.id)}
      />
      <IconButton
        icon="delete-outline"
        accessibilityLabel="Delete block"
        color="error"
        onPress={() => p.onDelete(block.id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' },
});
