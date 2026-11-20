import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../ui/AppText.tsx';
import { tapFeedback } from '../ui/haptics.ts';
import { Icon, type IconName } from '../ui/Icon.tsx';
import { shape, space, TOUCH } from '../ui/m3-tokens.ts';
import { StatePressable } from '../ui/StateLayer.tsx';
import { makeStyles, useTheme } from '../ui/theme.tsx';

export type InsertChoice = 'prose' | 'dialogue' | 'scene-break' | 'gimmick';

export const INSERT_CHOICES: readonly {
  choice: InsertChoice;
  label: string;
  icon: IconName;
  testID: string;
}[] = [
  { choice: 'prose', label: 'Prose', icon: 'notes', testID: 'insert-prose' },
  { choice: 'dialogue', label: 'Dialogue', icon: 'format-quote', testID: 'insert-dialogue' },
  { choice: 'scene-break', label: 'Scene', icon: 'horizontal-rule', testID: 'insert-scene-break' },
  { choice: 'gimmick', label: 'Gimmick', icon: 'auto-awesome', testID: 'insert-gimmick' },
];

const useStyles = makeStyles((t) => ({
  bar: {
    flexDirection: 'row',
    paddingTop: space.sm,
    paddingHorizontal: space.sm,
    backgroundColor: t.m3.surfaceContainer,
    borderTopWidth: 1,
    borderTopColor: t.m3.outlineVariant,
  },
  action: {
    flex: 1,
    minHeight: TOUCH + 8,
    borderRadius: shape.large,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
}));

/** M3 bottom app bar: four equal insert actions (icon over label). */
export function InsertBar({ onPick }: { onPick(choice: InsertChoice): void }): ReactNode {
  const insets = useSafeAreaInsets();
  const s = useStyles();
  const { m3 } = useTheme();
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      {INSERT_CHOICES.map((c) => (
        <StatePressable
          key={c.choice}
          accessibilityRole="button"
          accessibilityLabel={`Insert ${c.label}`}
          testID={c.testID}
          layerColor={m3.onSurface}
          onPress={() => {
            tapFeedback();
            onPick(c.choice);
          }}
          style={s.action}
        >
          <Icon name={c.icon} size={24} color={c.choice === 'gimmick' ? 'primary' : 'onSurface'} />
          <AppText variant="labelMedium" color="onSurfaceVariant" numberOfLines={1}>
            {c.label}
          </AppText>
        </StatePressable>
      ))}
    </View>
  );
}
