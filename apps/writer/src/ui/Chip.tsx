// M3 filter chip: 32dp, small (8dp) shape, outline when off; secondaryContainer + ✓ when on.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText.tsx';
import { Icon, type IconName } from './Icon.tsx';
import { shape, space } from './m3-tokens.ts';
import { slopFor, StatePressable } from './StateLayer.tsx';
import { useTheme } from './theme.tsx';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?(): void;
  /** Leading icon when not selected (selected chips always lead with ✓). */
  icon?: IconName;
  /** Optional leading colour dot (swatch / dialogue accent). */
  dot?: string;
  disabled?: boolean;
  testID?: string;
}

export function Chip(p: ChipProps): ReactNode {
  const { m3 } = useTheme();
  const fg = p.selected ? 'onSecondaryContainer' : 'onSurfaceVariant';
  return (
    <StatePressable
      accessibilityRole={p.onPress ? 'checkbox' : 'text'}
      accessibilityLabel={p.label}
      accessibilityState={{ checked: !!p.selected, disabled: !!p.disabled }}
      onPress={p.onPress}
      disabled={!p.onPress || p.disabled}
      testID={p.testID}
      hitSlop={slopFor(0, 32)}
      layerColor={m3[fg]}
      style={[
        styles.chip,
        p.selected
          ? { backgroundColor: m3.secondaryContainer, borderColor: m3.secondaryContainer }
          : { borderColor: m3.outline },
        (p.selected || p.icon || p.dot) && styles.withLeading,
        p.disabled && styles.disabled,
      ]}
    >
      <View style={styles.row}>
        {p.selected ? (
          <Icon name="check" size={18} color="onSecondaryContainer" />
        ) : p.icon ? (
          <Icon name={p.icon} size={18} color="primary" />
        ) : null}
        {p.dot ? <View style={[styles.dot, { backgroundColor: p.dot }]} /> : null}
        <AppText variant="labelLarge" color={p.selected ? 'onSecondaryContainer' : 'onSurface'}>
          {p.label}
        </AppText>
      </View>
    </StatePressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 32,
    borderRadius: shape.small,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  withLeading: { paddingLeft: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
  disabled: { opacity: 0.38 },
});
