// Faceted Gimmick Catalog browser: instant search, genre chips, Recent strip and a virtualized
// list. Opens from Interactive Studio's Insert Cue; one tap on a row inserts the cue.
import type { GimmickBlueprint } from '@kn/core/gimmicks';
import { resolveVisualDna } from '@kn/core/dna';
import { useCallback, useMemo, type ReactNode } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dnaFromNovel } from '../dna/dna-store.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { useRepoQuery } from '../store/context.tsx';
import { Field } from '../ui/Field.tsx';
import { IconBtn } from '../ui/IconBtn.tsx';
import { Txt } from '../ui/Txt.tsx';
import { radius, space, withAlpha } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { BlueprintCard, CARD_HEIGHT } from './BlueprintCard.tsx';
import { FAVORITES } from './catalog-model.ts';
import { GenreChips, RecentStrip } from './CatalogChips.tsx';
import { useCatalog } from './use-catalog.ts';
import type { CatalogEntry } from '../db/catalog-repo.ts';

export interface CatalogSheetProps {
  visible: boolean;
  novelId: string;
  onPick(bp: GimmickBlueprint): void;
  onClose(): void;
}

const keyOf = (e: CatalogEntry): string => e.row.id;

export function CatalogSheet(p: CatalogSheetProps): ReactNode {
  const { t } = useI18n();
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const cat = useCatalog(p.visible);
  const { data: novel } = useRepoQuery(`catalog-dna:${p.novelId}`, (r) =>
    r.requireNovel(p.novelId),
  );
  const dna = useMemo(() => dnaFromNovel(novel ?? { id: p.novelId }), [novel, p.novelId]);
  const look = useMemo(() => resolveVisualDna(dna, dark ? 'dark' : 'light'), [dna, dark]);
  const { pushRecent, toggleFavorite, favorites } = cat;
  const insert = useCallback(
    (bp: GimmickBlueprint) => {
      pushRecent(bp.id);
      p.onPick(bp);
    },
    [pushRecent, p],
  );
  const render = useCallback(
    ({ item }: { item: CatalogEntry }) =>
      item.blueprint ? (
        <BlueprintCard
          blueprint={item.blueprint}
          dna={dna}
          look={look}
          favorite={favorites.has(item.row.id)}
          onInsert={insert}
          onToggleFavorite={toggleFavorite}
        />
      ) : null,
    [dna, look, favorites, insert, toggleFavorite],
  );
  const total = cat.chips[0]?.count ?? 0;
  const favMode = cat.chip === FAVORITES && !cat.text.trim();

  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: withAlpha(colors.scrim, dark ? 0.5 : 0.28) },
          ]}
          onPress={p.onClose}
          accessibilityRole="button"
          accessibilityLabel={t('catalog.close')}
          focusable={false}
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, space.xs) },
          ]}
          testID="catalog-sheet"
        >
          <View style={styles.header}>
            <View style={styles.title}>
              <Txt variant="heading" numberOfLines={1} accessibilityRole="header">
                {t('catalog.title')}
              </Txt>
              <Txt variant="meta" color="inkSecondary" numberOfLines={1}>
                {t('catalog.count', { n: total })}
              </Txt>
            </View>
            <IconBtn
              icon="x"
              accessibilityLabel={t('catalog.close')}
              onPress={p.onClose}
              testID="catalog-close"
            />
          </View>
          <View style={styles.pad}>
            <Field
              dense
              value={cat.text}
              onChangeText={cat.setText}
              placeholder={t('catalog.search')}
              accessibilityLabel={t('catalog.search')}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              testID="catalog-search"
            />
          </View>
          <GenreChips chips={cat.chips} active={cat.chip} onPick={cat.setChip} />
          {cat.recent.length > 0 && !cat.text.trim() && cat.chip === 'all' ? (
            <RecentStrip items={cat.recent} onPick={insert} />
          ) : null}
          {!cat.ready ? (
            <Txt color="inkSecondary" style={styles.pad}>
              {t('catalog.loading')}
            </Txt>
          ) : cat.results.length === 0 ? (
            <View style={[styles.pad, styles.empty]} testID="catalog-empty">
              <Txt variant="bodyStrong">
                {t(favMode && cat.favorites.size === 0 ? 'catalog.emptyFavs' : 'catalog.empty')}
              </Txt>
              <Txt variant="meta" color="inkSecondary">
                {t(
                  favMode && cat.favorites.size === 0
                    ? 'catalog.emptyFavsHint'
                    : 'catalog.emptyHint',
                )}
              </Txt>
            </View>
          ) : (
            <FlatList
              data={cat.results}
              renderItem={render}
              keyExtractor={keyOf}
              getItemLayout={(_, index) => ({
                length: CARD_HEIGHT,
                offset: CARD_HEIGHT * index,
                index,
              })}
              initialNumToRender={10}
              maxToRenderPerBatch={12}
              windowSize={7}
              removeClippedSubviews
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.pad}
              style={styles.list}
              testID="catalog-list"
              accessibilityLabel={t('catalog.count', { n: cat.results.length })}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    height: '90%',
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    overflow: 'hidden',
    paddingTop: space.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.lg,
    paddingRight: space.xxs,
  },
  title: { flex: 1, gap: 1 },
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
  list: { flex: 1 },
  empty: { paddingVertical: space.xl },
});
