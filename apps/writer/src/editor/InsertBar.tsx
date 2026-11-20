// Insert choices (prose, dialogue, scene break, gimmick) and a quiet Folio bar that lists them.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyph, type GlyphName } from '../ui/Glyph.tsx';
import { tapFeedback } from '../ui/haptics.ts';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space, TOUCH } from '../ui/tokens.ts';
import { makeStyles } from '../ui/theme.tsx';

export type InsertChoice = 'prose' | 'dialogue' | 'scene-break' | 'gimmick';

export const INSERT_CHOICES: readonly {
  choice: InsertChoice;
  label: string;
  icon: GlyphName;
  testID: string;
}[] = [
  { choice: 'prose', label: 'Prose', icon: 'align-left', testID: 'insert-prose' },
  { choice: 'dialogue', label: 'Dialogue', icon: 'message-square', testID: 'insert-dialogue' },
  { choice: 'scene-break', label: 'Scene', icon: 'more-horizontal', testID: 'insert-scene-break' },
  { choice: 'gimmick', label: 'Gimmick', icon: 'zap', testID: 'insert-gimmick' },
];

const useStyles = makeStyles((t) => ({
  bar: {
    flexDirection: 'row',
    paddingTop: space.xs,
    paddingHorizontal: space.xs,
    backgroundColor: t.colors.surface,
    borderTopWidth: 1,
    borderColor: t.colors.hairline,
  },
}));

export function InsertBar({ onPick }: { onPick(choice: InsertChoice): void }): ReactNode {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, space.xs) }]}>
      {INSERT_CHOICES.map((c) => (
        <Press
          key={c.choice}
          accessibilityRole="button"
          accessibilityLabel={`Insert ${c.label}`}
          testID={c.testID}
          onPress={() => {
            tapFeedback();
            onPick(c.choice);
          }}
          style={styles.action}
        >
          <Glyph
            name={c.icon}
            size={18}
            color={c.choice === 'gimmick' ? 'accent' : 'inkSecondary'}
          />
          <Txt variant="caption" color="inkSecondary" numberOfLines={1}>
            {c.label}
          </Txt>
        </Press>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  action: { flex: 1, minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
