import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { WriterModule } from '../modules/registry.ts';
import { Toggle } from '../ui/Toggle.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';

/** One hairline settings row per gimmick module: name, description, Folio toggle. */
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
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderColor: colors.hairline }]}>
      <View style={styles.head}>
        <View style={styles.text}>
          <Txt variant="body">{m.meta.name}</Txt>
          <Txt variant="meta" color="inkSecondary">
            {m.meta.description}
          </Txt>
        </View>
        <Toggle
          value={enabled}
          onValueChange={onChange}
          accessibilityLabel={`Enable ${m.meta.name}`}
          testID={`module-toggle-${m.meta.id}`}
        />
      </View>
      {!enabled && usedBy > 0 ? (
        <Txt variant="caption" color="danger" testID={`module-warning-${m.meta.id}`}>
          Used by {usedBy} {usedBy === 1 ? 'block' : 'blocks'} — they stay in your chapters but the
          reader skips them
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: 1, paddingVertical: space.sm, gap: space.xxs, minHeight: 56 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flex: 1, gap: 2 },
});
