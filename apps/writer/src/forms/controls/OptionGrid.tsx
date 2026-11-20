// Clean 2-column grid of selectable hairline tiles (selected = accent border + soft accent fill,
// never a ✓). Used by long single-select lists and by multi-select.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { tapFeedback } from '../../ui/haptics.ts';
import { Press } from '../../ui/Press.tsx';
import { Txt } from '../../ui/Txt.tsx';
import { radius, space, TOUCH } from '../../ui/tokens.ts';
import { useTheme } from '../../ui/theme.tsx';

export interface OptionGridProps {
  options: readonly { value: string; label: string }[];
  isSelected(value: string): boolean;
  onPick(value: string): void;
  /** Tiles that are not selected and cannot be picked (e.g. max items reached). */
  isDisabled?(value: string): boolean;
  role: 'radio' | 'checkbox';
  testIDFor(value: string): string;
}

export function OptionGrid(p: OptionGridProps): ReactNode {
  const { colors } = useTheme();
  return (
    <View style={styles.grid}>
      {p.options.map((o) => {
        const on = p.isSelected(o.value);
        const off = !on && !!p.isDisabled?.(o.value);
        return (
          <Press
            key={o.value}
            accessibilityRole={p.role}
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on, checked: on, disabled: off }}
            disabled={off}
            testID={p.testIDFor(o.value)}
            wash={on ? null : undefined}
            onPress={() => {
              tapFeedback();
              p.onPick(o.value);
            }}
            style={[
              styles.tile,
              {
                borderColor: on ? colors.accent : colors.hairline,
                backgroundColor: on ? colors.accentSoft : 'transparent',
              },
            ]}
          >
            <Txt
              variant="label"
              color={on ? 'accent' : 'ink'}
              numberOfLines={2}
              style={styles.label}
            >
              {o.label}
            </Txt>
          </Press>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  tile: {
    width: '48.5%',
    minHeight: TOUCH,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    justifyContent: 'center',
  },
  label: { textAlign: 'center' },
});
