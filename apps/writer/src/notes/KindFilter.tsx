// Compact kind filter strip for the Notes workspace: All | Notes | Characters | Locations | Lore.
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useI18n } from '../i18n/I18nProvider.tsx';
import type { StringKey } from '../i18n/i18n.ts';
import { hitSlopFor } from '../ui/a11y.ts';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { radius, space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { KIND_META, STORY_KINDS, type StoryKind } from './kind-meta.ts';

export type KindFilterValue = 'all' | StoryKind;

const OPTIONS: readonly { value: KindFilterValue; labelKey: StringKey }[] = [
  { value: 'all', labelKey: 'kinds.all' },
  ...STORY_KINDS.map((k) => ({ value: k, labelKey: KIND_META[k].pluralKey })),
];

/** Pills are 32 dp tall; hitSlop grows the touch target to 48 dp without changing visuals. */
const PILL_SLOP = hitSlopFor(64, 32);

export function KindFilter(p: {
  value: KindFilterValue;
  onChange(v: KindFilterValue): void;
}): ReactNode {
  const { colors } = useTheme();
  const { t } = useI18n();
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
        const label = t(o.labelKey);
        return (
          <Press
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t('kinds.show', { kind: label })}
            hitSlop={PILL_SLOP}
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
              {label}
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
