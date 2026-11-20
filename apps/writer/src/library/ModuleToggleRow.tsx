import type { ReactNode } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import type { WriterModule } from '../modules/registry.ts';
import { Badge, Card } from '../ui/layout.tsx';
import { colors, space } from '../ui/theme.ts';

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
        <Text style={styles.icon}>{m.meta.icon}</Text>
        <View style={styles.text}>
          <Text style={styles.name}>{m.meta.name}</Text>
          <Badge label={m.meta.layer.toUpperCase()} />
        </View>
        <Switch
          value={enabled}
          onValueChange={onChange}
          accessibilityLabel={`Enable ${m.meta.name}`}
          trackColor={{ true: colors.accent, false: colors.line }}
          testID={`module-toggle-${m.meta.id}`}
        />
      </View>
      <Text style={styles.desc}>{m.meta.description}</Text>
      {!enabled && usedBy > 0 ? (
        <Text style={styles.warn} testID={`module-warning-${m.meta.id}`}>
          Used by {usedBy} {usedBy === 1 ? 'block' : 'blocks'} — they stay in your chapters but the
          reader skips them
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  icon: { fontSize: 28 },
  text: { flex: 1, gap: 4, alignItems: 'flex-start' },
  name: { color: colors.fg, fontSize: 16, fontWeight: '700' },
  desc: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  warn: { color: colors.warn, fontSize: 13, fontWeight: '600' },
});
