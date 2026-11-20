import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getWriterModule } from '../modules/registry.ts';
import { tapFeedback } from '../ui/haptics.ts';
import { Badge } from '../ui/layout';
import { colors, radius, space, TAP } from '../ui/legacy-theme.ts';
import type { ModuleBlockT } from './block-types.ts';

/** Compact summary card; everything shown comes from the module's own `summarize()`. */
export function GimmickPill(p: {
  block: ModuleBlockT;
  enabled: boolean;
  onOpen(): void;
}): ReactNode {
  const module = getWriterModule(p.block.moduleId);
  if (!module) {
    return (
      <View style={[styles.pill, styles.unknown]} testID={`pill-${p.block.id}`}>
        <Text style={styles.title}>Unknown gimmick {p.block.moduleId}</Text>
      </View>
    );
  }
  const card = module.summarize(p.block.props);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.title}. ${card.subtitle}`}
      onPress={() => {
        tapFeedback();
        p.onOpen();
      }}
      testID={`pill-${p.block.id}`}
      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <Text style={styles.title} numberOfLines={1}>
          {card.title}
        </Text>
        {card.badge ? <Badge label={card.badge} tone="accent" /> : null}
      </View>
      <Text style={styles.subtitle} numberOfLines={2}>
        {card.subtitle}
      </Text>
      <View style={styles.tags}>
        <Badge label={module.meta.layer} />
        {p.enabled ? null : <Badge label="Not enabled in this novel" tone="warn" />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: TAP,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.md,
    gap: space.xs,
  },
  unknown: { borderColor: colors.danger, borderStyle: 'dashed' },
  pressed: { opacity: 0.8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, color: colors.fg, fontSize: 16, fontWeight: '700' },
  subtitle: { color: colors.muted, fontSize: 14 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
