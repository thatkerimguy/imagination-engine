// M3 extended FAB: 56dp, large shape, primaryContainer, anchored bottom-right above the safe area.
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText.tsx';
import { Icon, type IconName } from './Icon.tsx';
import { shape, space } from './m3-tokens.ts';
import { StatePressable } from './StateLayer.tsx';
import { useTheme } from './theme.tsx';

export interface FabProps {
  label: string;
  icon: IconName;
  onPress(): void;
  testID?: string;
}

export function Fab(p: FabProps): ReactNode {
  const { m3 } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={[styles.anchor, { bottom: space.lg + insets.bottom, right: space.lg + insets.right }]}
    >
      <StatePressable
        accessibilityRole="button"
        accessibilityLabel={p.label}
        onPress={p.onPress}
        testID={p.testID}
        layerColor={m3.onPrimaryContainer}
        style={[styles.fab, { backgroundColor: m3.primaryContainer }, elevation]}
      >
        <View style={styles.row}>
          <Icon name={p.icon} color="onPrimaryContainer" />
          <AppText variant="labelLarge" color="onPrimaryContainer">
            {p.label}
          </AppText>
        </View>
      </StatePressable>
    </View>
  );
}

/** M3 level-3 elevation. */
const elevation = Platform.select({
  web: { boxShadow: '0 4px 8px 3px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.3)' },
  default: {
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});

const styles = StyleSheet.create({
  anchor: { position: 'absolute' },
  fab: {
    height: 56,
    minWidth: 80,
    borderRadius: shape.large,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
