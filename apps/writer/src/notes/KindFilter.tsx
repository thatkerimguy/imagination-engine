// Compact kind filter strip for the Notes workspace: All | Notes | Characters | Locations | Lore.
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { radius, space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { KIND_META, STORY_KINDS, type StoryKind } from './kind-meta.ts';

export type KindFilterValue = 'all' | StoryKind;

const OPTIONS: readonly { value: KindFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  ...STORY_KINDS.map((k) => ({ value: k, label: KIND_META[k].plural })),
];

export function KindFilter(p: {
  value: KindFilterValue;
  onChange(v: KindFilterValue): void;
}): ReactNode {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      style={styles.scroll}
      testID="notes-kind-filter"
    >
      {OPTIONS.map((o) => {
        const on = o.value === p.value;
        return (
          <Press
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`Show ${o.label}`}
            onPress={() => p.onChange(o.value)}
            style={[
              styles.pill,
              {
                backgroundColor: on ? colors.surfaceTint : 'transparent',
                borderColor: colors.hairline,
              },
            ]}
            testID={`notes-kind-filter-${o.value}`}
          >
            <Txt variant="meta" color={on ? 'ink' : 'inkSecondary'}>
              {o.label}
            </Txt>
          </Press>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  strip: { gap: space.xs, paddingVertical: space.xs },
  pill: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
