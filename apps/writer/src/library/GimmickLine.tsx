import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { enabledWriterModules } from '../modules/registry.ts';
import { AppText } from '../ui/AppText.tsx';
import { Icon } from '../ui/Icon.tsx';
import { IconBadge } from '../ui/layout.tsx';
import { space } from '../ui/m3-tokens.ts';
import { StatePressable } from '../ui/StateLayer.tsx';
import { useTheme } from '../ui/theme.tsx';

/** Subtle "Gimmicks" row of enabled module badges; tapping opens novel settings. */
export function GimmickLine({
  enabled,
  onPress,
}: {
  enabled: readonly string[];
  onPress(): void;
}): ReactNode {
  const { m3 } = useTheme();
  const mods = enabledWriterModules(enabled);
  return (
    <StatePressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Gimmick modules"
      testID="outline-gimmicks"
      layerColor={m3.onSurface}
      style={styles.row}
    >
      <AppText variant="labelLarge" color="onSurfaceVariant">
        Gimmicks
      </AppText>
      <View style={styles.badges}>
        {mods.length ? (
          mods.map((m) => <IconBadge key={m.meta.id} glyph={m.meta.icon} size={32} />)
        ) : (
          <AppText variant="bodySmall" color="onSurfaceVariant">
            none yet
          </AppText>
        )}
      </View>
      <Icon name="chevron-right" size={24} color="onSurfaceVariant" />
    </StatePressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 48,
    paddingHorizontal: space.sm,
    borderRadius: 12,
  },
  badges: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
