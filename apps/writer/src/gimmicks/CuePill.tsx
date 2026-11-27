// Cue strip for a v2 (blueprint) cue: same Folio strip as v1 pills, titled by the blueprint.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ModuleBlockT } from '../editor/block-types.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { MIN_TOUCH } from '../ui/a11y.ts';
import { Glyph } from '../ui/Glyph.tsx';
import { tapFeedback } from '../ui/haptics.ts';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { radius } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { cueBlueprintId, cueSummary, starterCueBlueprint } from './cue.ts';
import { engineGlyph } from './engine-look.ts';
import { useBlueprint } from './use-catalog.ts';

export function CuePill(p: { block: ModuleBlockT; onOpen(): void }): ReactNode {
  const { colors } = useTheme();
  const { t } = useI18n();
  const id = cueBlueprintId(p.block.props);
  const bp = useBlueprint(id, starterCueBlueprint(p.block.props));
  const title = bp?.name ?? t('cue.unknown', { id: id ?? '?' });
  const sub = bp ? cueSummary(bp, p.block.props) : t('cue.missing');
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      onPress={() => {
        tapFeedback();
        p.onOpen();
      }}
      testID={`pill-${p.block.id}`}
      wash={colors.accentSoft}
      style={[styles.strip, { backgroundColor: colors.surfaceTint }]}
    >
      <View style={[styles.bar, { backgroundColor: colors.accent }]} />
      <Glyph name={engineGlyph(p.block.moduleId)} size={18} color="accent" />
      <View style={styles.text}>
        <View style={styles.head}>
          <Txt variant="bodyStrong" numberOfLines={1} style={styles.grow}>
            {title}
          </Txt>
          <Txt variant="caption" color="inkSecondary" numberOfLines={1}>
            {(bp?.tier === 'pro' ? t('catalog.pro') : p.block.moduleId).toUpperCase()}
          </Txt>
        </View>
        <Txt variant="meta" color="inkSecondary" numberOfLines={2}>
          {sub}
        </Txt>
        {p.block.beatStop ? (
          <View style={styles.head}>
            <Glyph name="pause" size={11} color="inkMuted" />
            <Txt variant="caption" color="inkMuted">
              {t('cue.beatStop')}
            </Txt>
          </View>
        ) : null}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    overflow: 'hidden',
    minHeight: MIN_TOUCH,
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  text: { flex: 1, gap: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
});
