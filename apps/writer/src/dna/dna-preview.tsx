// Live Book Preview Card: paired dark + light swatches in pure React Native, from the resolved DNA.
import {
  apcaContrast,
  resolveVisualDna,
  wcagContrast,
  type BookVisualDna,
  type DnaTheme,
} from '@kn/core/dna';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { radiusDp } from './dna-look.ts';
import { fontFamilyFor } from './dna-fonts.ts';

function Panel({ dna, theme }: { dna: BookVisualDna; theme: DnaTheme }): ReactNode {
  const { t } = useI18n();
  const r = resolveVisualDna(dna, theme);
  const c = r.colors;
  const ratio = wcagContrast(c['--dna-ink'], c['--dna-surface']);
  const lc = Math.abs(apcaContrast(c['--dna-ink'], c['--dna-surface']));
  const corner = radiusDp(dna.ornament.radius);
  const spacing =
    dna.typography.tracking === 'wide' ? 1 : dna.typography.tracking === 'tight' ? -0.3 : 0;
  return (
    <View
      style={[styles.panel, { backgroundColor: c['--dna-bg'] }]}
      testID={`dna-preview-${theme}`}
      accessible
      accessibilityLabel={`${t(theme === 'dark' ? 'dna.dark' : 'dna.light')}. ${t(
        'dna.contrastA11y',
        {
          ratio: ratio.toFixed(1),
          lc: Math.round(lc),
        },
      )}`}
    >
      <Txt variant="overline" color={c['--dna-muted'] as `#${string}`} numberOfLines={1}>
        {t(theme === 'dark' ? 'dna.dark' : 'dna.light')}
      </Txt>
      <View
        style={[
          styles.card,
          {
            backgroundColor: c['--dna-surface'],
            borderColor: c['--dna-accent'],
            borderRadius: corner,
            borderWidth: Math.max(1, dna.ornament.strokeWidth),
          },
        ]}
      >
        <Txt
          color={c['--dna-ink'] as `#${string}`}
          style={{
            fontFamily: fontFamilyFor(dna.typography.display),
            fontSize: 18,
            lineHeight: 24,
            letterSpacing: spacing,
          }}
          numberOfLines={2}
        >
          {t('dna.sampleDisplay')}
        </Txt>
        <Txt
          color={c['--dna-muted'] as `#${string}`}
          style={{ fontFamily: fontFamilyFor(dna.typography.prose), fontSize: 13, lineHeight: 18 }}
          numberOfLines={3}
        >
          {t('dna.sampleProse')}
        </Txt>
        <Txt
          color={c['--dna-accent'] as `#${string}`}
          style={{ fontFamily: fontFamilyFor(dna.typography.diegetic), fontSize: 11 }}
          numberOfLines={1}
        >
          {t('dna.sampleCue')}
        </Txt>
      </View>
      <View style={styles.dots}>
        {(['--dna-accent', '--dna-accent-2', '--dna-ok', '--dna-warn'] as const).map((k) => (
          <View
            key={k}
            style={[styles.dot, { backgroundColor: c[k], borderColor: c['--dna-border'] }]}
          />
        ))}
      </View>
      <View style={styles.badges}>
        <Txt variant="caption" color={c['--dna-ink'] as `#${string}`}>
          {t('dna.ratio', { ratio: ratio.toFixed(1) })}
        </Txt>
        <Txt variant="caption" color={c['--dna-ink'] as `#${string}`}>
          {t('dna.apca', { lc: Math.round(lc) })}
        </Txt>
      </View>
    </View>
  );
}

export function DnaPreviewCard({ dna }: { dna: BookVisualDna }): ReactNode {
  return (
    <View style={styles.row} testID="dna-preview-card">
      <Panel dna={dna} theme="dark" />
      <Panel dna={dna} theme="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xs },
  panel: { flex: 1, minWidth: 0, padding: space.xs, gap: space.xs, borderRadius: 12 },
  card: { padding: space.xs, gap: 4 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
});
