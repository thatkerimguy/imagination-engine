import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { WriterModule } from '../modules/registry.ts';
import { AppText } from '../ui/AppText.tsx';
import { Card, IconBadge } from '../ui/layout.tsx';
import { space } from '../ui/m3-tokens.ts';
import { Switch } from '../ui/Switch.tsx';

export function ModuleToggleRow({
  module: m,
  enabled,
  usedBy,
  onChange,
}: {
  module: WriterModule;
  enabled: boolean;
  usedBy: number;
  onChange(on: boolean): void;
}): ReactNode {
  return (
    <Card>
      <View style={styles.head}>
        <IconBadge glyph={m.meta.icon} />
        <View style={styles.text}>
          <AppText variant="titleMedium">{m.meta.name}</AppText>
          <AppText variant="bodySmall" color="onSurfaceVariant">
            {m.meta.description}
          </AppText>
          <AppText variant="labelSmall" color="onSurfaceVariant">
            {m.meta.layer.toUpperCase()}
          </AppText>
        </View>
        <Switch
          value={enabled}
          onValueChange={onChange}
          accessibilityLabel={`Enable ${m.meta.name}`}
          testID={`module-toggle-${m.meta.id}`}
        />
      </View>
      {!enabled && usedBy > 0 ? (
        <AppText variant="bodySmall" color="error" testID={`module-warning-${m.meta.id}`}>
          Used by {usedBy} {usedBy === 1 ? 'block' : 'blocks'} — they stay in your chapters but the
          reader skips them
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flex: 1, gap: 2 },
});
