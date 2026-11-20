import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WriterModule } from '../modules/registry.ts';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { Muted } from '../ui/layout';
import { colors, radius, space, TAP } from '../ui/theme.ts';
import { INSERT_CHOICES, type InsertChoice } from './InsertBar.tsx';

/** "+ Below": the same insert choices, as a sheet. */
export function InsertChoiceSheet(p: {
  visible: boolean;
  onPick(choice: InsertChoice): void;
  onClose(): void;
}): ReactNode {
  return (
    <BottomSheet visible={p.visible} title="Insert below" onClose={p.onClose}>
      <View style={styles.list}>
        {INSERT_CHOICES.map((c) => (
          <Button key={c.choice} label={`+ ${c.label}`} onPress={() => p.onPick(c.choice)} />
        ))}
      </View>
    </BottomSheet>
  );
}

/** Lists only the modules the novel has enabled. */
export function GimmickPicker(p: {
  visible: boolean;
  modules: readonly WriterModule[];
  onPick(module: WriterModule): void;
  onClose(): void;
}): ReactNode {
  return (
    <BottomSheet
      visible={p.visible}
      title="Add a gimmick"
      onClose={p.onClose}
      testID="gimmick-picker"
    >
      {p.modules.length === 0 ? (
        <Muted>
          No gimmicks are enabled for this novel. Turn them on in Novel Settings, then come back.
        </Muted>
      ) : (
        p.modules.map((m) => (
          <Pressable
            key={m.meta.id}
            accessibilityRole="button"
            onPress={() => p.onPick(m)}
            testID={`pick-${m.meta.id}`}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <Text style={styles.icon}>{m.meta.icon}</Text>
            <View style={styles.text}>
              <Text style={styles.name}>{m.meta.name}</Text>
              <Text style={styles.desc}>{m.meta.description}</Text>
            </View>
          </Pressable>
        ))
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  item: {
    minHeight: TAP,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  pressed: { opacity: 0.8 },
  icon: { fontSize: 26 },
  text: { flex: 1, gap: 2 },
  name: { color: colors.fg, fontSize: 16, fontWeight: '700' },
  desc: { color: colors.muted, fontSize: 13 },
});
