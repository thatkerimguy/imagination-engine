import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tapFeedback } from '../ui/haptics.ts';
import { colors, radius, space } from '../ui/legacy-theme.ts';

export type InsertChoice = 'prose' | 'dialogue' | 'scene-break' | 'gimmick';

export const INSERT_CHOICES: readonly {
  choice: InsertChoice;
  label: string;
  glyph: string;
  testID: string;
}[] = [
  { choice: 'prose', label: 'Prose', glyph: '¶', testID: 'insert-prose' },
  { choice: 'dialogue', label: 'Dialogue', glyph: '❝', testID: 'insert-dialogue' },
  { choice: 'scene-break', label: 'Scene Break', glyph: '◆', testID: 'insert-scene-break' },
  { choice: 'gimmick', label: 'Gimmick', glyph: '✦', testID: 'insert-gimmick' },
];

/** Sticky bottom bar: four equal, thumb-sized insert buttons. */
export function InsertBar({ onPick }: { onPick(choice: InsertChoice): void }): ReactNode {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      {INSERT_CHOICES.map((c) => (
        <Pressable
          key={c.choice}
          accessibilityRole="button"
          accessibilityLabel={`+ ${c.label}`}
          testID={c.testID}
          onPress={() => {
            tapFeedback();
            onPick(c.choice);
          }}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={[styles.glyph, c.choice === 'gimmick' && styles.accent]}>+ {c.glyph}</Text>
          <Text style={styles.label} numberOfLines={1}>
            {c.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  button: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  pressed: { opacity: 0.7 },
  glyph: { color: colors.fg, fontSize: 16, fontWeight: '700' },
  accent: { color: colors.accent },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600' },
});
