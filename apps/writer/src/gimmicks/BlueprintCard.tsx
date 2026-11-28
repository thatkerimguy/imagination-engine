// One catalog row: a DNA-tinted miniature (pure RN), name, tagline, engine + tier badges, favorite
// star and 1-tap insert. Fixed height so the FlatList can use getItemLayout at 1,000 rows.
import type { GimmickBlueprint } from '@kn/core/gimmicks';
import type { ResolvedVisualDna } from '@kn/core/dna';
import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { fontFamilyFor } from '../dna/dna-fonts.ts';
import { radiusDp } from '../dna/dna-look.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import type { StringKey } from '../i18n/i18n.ts';
import { Glyph } from '../ui/Glyph.tsx';
import { MIN_TOUCH } from '../ui/a11y.ts';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { radius, space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { engineGlyph } from './engine-look.ts';
import type { BookVisualDna } from '@kn/core/dna';

export const CARD_HEIGHT = 84;

export interface BlueprintCardProps {
  blueprint: GimmickBlueprint;
  dna: BookVisualDna;
  look: ResolvedVisualDna;
  favorite: boolean;
  onInsert(bp: GimmickBlueprint): void;
  onToggleFavorite(id: string): void;
}

function Miniature({
  dna,
  look,
  engine,
}: {
  dna: BookVisualDna;
  look: ResolvedVisualDna;
  engine: string;
}): ReactNode {
  const c = look.colors;
  return (
    <View
      style={[
        styles.mini,
        {
          backgroundColor: c['--dna-surface'],
          borderColor: c['--dna-accent'],
          borderRadius: radiusDp(dna.ornament.radius, 0.8),
        },
      ]}
    >
      <Glyph name={engineGlyph(engine)} size={20} color={c['--dna-accent'] as `#${string}`} />
      <Txt
        color={c['--dna-ink'] as `#${string}`}
        numberOfLines={1}
        style={{ fontFamily: fontFamilyFor(dna.typography.display), fontSize: 10 }}
      >
        Aa
      </Txt>
    </View>
  );
}

function BlueprintCardImpl(p: BlueprintCardProps): ReactNode {
  const { t } = useI18n();
  const { colors } = useTheme();
  const bp = p.blueprint;
  return (
    <View style={[styles.row, { borderColor: colors.hairline }]}>
      <Press
        accessibilityRole="button"
        accessibilityLabel={t('catalog.insertA11y', { name: bp.name, tagline: bp.tagline })}
        testID={`blueprint-card-${bp.id}`}
        onPress={() => p.onInsert(bp)}
        style={styles.main}
      >
        <Miniature dna={p.dna} look={p.look} engine={bp.engine} />
        <View style={styles.text}>
          <Txt variant="bodyStrong" numberOfLines={1}>
            {bp.name}
          </Txt>
          <Txt variant="meta" color="inkSecondary" numberOfLines={1}>
            {bp.tagline}
          </Txt>
          <View style={styles.badges}>
            <Txt variant="caption" color="inkMuted" numberOfLines={1} style={styles.engine}>
              {t(`engine.${bp.engine}` as StringKey)}
            </Txt>
            {bp.tier === 'pro' ? (
              <View
                style={[styles.pro, { backgroundColor: colors.accentSoft }]}
                testID={`blueprint-pro-${bp.id}`}
              >
                <Txt variant="caption" color="accent" numberOfLines={1}>
                  {t('catalog.pro').toUpperCase()}
                </Txt>
              </View>
            ) : null}
          </View>
        </View>
      </Press>
      <Press
        accessibilityRole="button"
        accessibilityLabel={t(p.favorite ? 'catalog.unfavorite' : 'catalog.favorite', {
          name: bp.name,
        })}
        accessibilityState={{ selected: p.favorite }}
        testID={`blueprint-fav-${bp.id}`}
        onPress={() => p.onToggleFavorite(bp.id)}
        style={styles.star}
      >
        <Glyph name="star" size={20} color={p.favorite ? 'warm' : 'inkMuted'} />
      </Press>
    </View>
  );
}

export const BlueprintCard = memo(BlueprintCardImpl);

const styles = StyleSheet.create({
  row: { height: CARD_HEIGHT, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  main: {
    flex: 1,
    minWidth: 0,
    height: CARD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  mini: {
    width: 56,
    height: 56,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  badges: { flexDirection: 'row', gap: space.xs, alignItems: 'center' },
  engine: { flexShrink: 1 },
  pro: { paddingHorizontal: space.xs, borderRadius: radius.pill },
  star: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
});
