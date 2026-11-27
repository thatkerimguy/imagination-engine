// Genre chip row and Recent strip of the Catalog browser.
import type { GimmickBlueprint } from '@kn/core/gimmicks';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider.tsx';
import type { StringKey } from '../i18n/i18n.ts';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { radius, space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { FAVORITES, genreFallbackLabel, type GenreChip } from './catalog-model.ts';

const GENRE_KEYS = new Set([
  'litrpg',
  'cyberpunk',
  'thriller',
  'fantasy',
  'mystery',
  'sci-fi',
  'horror',
  'core',
]);

export function GenreChips({
  chips,
  active,
  onPick,
}: {
  chips: GenreChip[];
  active: string;
  onPick(id: string): void;
}): ReactNode {
  const { t } = useI18n();
  const { colors } = useTheme();
  const chipLabel = (id: string): string =>
    id === 'all' || id === FAVORITES || GENRE_KEYS.has(id)
      ? t(`catalog.genre.${id}` as StringKey)
      : genreFallbackLabel(id);
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipScroll}
      contentContainerStyle={styles.chips}
      keyboardShouldPersistTaps="handled"
    >
      {chips.map((c) => {
        const on = c.id === active;
        return (
          <Press
            key={c.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t('catalog.chipA11y', {
              label: chipLabel(c.id),
              n: c.count ?? 0,
            })}
            testID={`catalog-chip-${c.id}`}
            wash={null}
            hitSlop={6}
            onPress={() => onPick(c.id)}
            style={[
              styles.chip,
              {
                backgroundColor: on ? colors.accentSoft : 'transparent',
                borderColor: on ? colors.accent : colors.hairline,
              },
            ]}
          >
            <Txt variant="label" color={on ? 'accent' : 'inkSecondary'} numberOfLines={1}>
              {chipLabel(c.id)}
              {c.count !== null ? ` ${c.count}` : ''}
            </Txt>
          </Press>
        );
      })}
    </ScrollView>
  );
}

export function RecentStrip({
  items,
  onPick,
}: {
  items: GimmickBlueprint[];
  onPick(bp: GimmickBlueprint): void;
}): ReactNode {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <View style={styles.pad}>
      <Txt variant="overline" color="inkSecondary">
        {t('catalog.recent')}
      </Txt>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        keyboardShouldPersistTaps="handled"
        testID="catalog-recent"
      >
        {items.map((bp) => (
          <Press
            key={bp.id}
            accessibilityRole="button"
            accessibilityLabel={t('catalog.insertA11y', {
              name: bp.name,
              tagline: bp.tagline,
            })}
            testID={`catalog-recent-${bp.id}`}
            onPress={() => onPick(bp)}
            style={[styles.chip, { borderColor: colors.hairline }]}
          >
            <Txt variant="label" numberOfLines={1}>
              {bp.name}
            </Txt>
          </Press>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.lg, gap: space.xs },
  chipScroll: { flexGrow: 0, minHeight: 52 },
  chips: {
    paddingHorizontal: space.lg,
    gap: space.xs,
    alignItems: 'center',
    paddingVertical: space.xs,
  },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
