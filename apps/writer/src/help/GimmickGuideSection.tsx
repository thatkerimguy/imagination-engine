// Gimmick Guide, generated from the bundled starter blueprints (no per-gimmick copy): one row per
// blueprint with its engine glyph, genre and tagline. Adding a blueprint adds a row.
import { STARTER_BLUEPRINT_LIST } from '@kn/engines/blueprints';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { engineGlyph } from '../gimmicks/engine-look.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { CardGroup } from '../ui/CardGroup.tsx';
import { Glyph } from '../ui/Glyph.tsx';
import { SectionLabel } from '../ui/Page.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';

const label = (s: string): string =>
  s
    .split('-')
    .map((w) => (w === 'litrpg' ? 'LitRPG' : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');

export function GimmickGuideSection(): ReactNode {
  const { t } = useI18n();
  return (
    <View style={styles.section} testID="help-gimmick-guide">
      <SectionLabel>{t('help.gimmicks')}</SectionLabel>
      <CardGroup>
        {STARTER_BLUEPRINT_LIST.map((bp) => (
          <View key={bp.id} style={styles.row} testID={`help-module-${bp.id}`}>
            <Glyph name={engineGlyph(bp.engine)} size={20} color="accent" />
            <View style={styles.text}>
              <Txt variant="bodyStrong">{bp.name}</Txt>
              <Txt variant="caption" color="inkMuted">
                {`${label(bp.genre)} · ${label(bp.engine)}`}
              </Txt>
              <Txt variant="meta" color="inkSecondary">
                {bp.tagline}
              </Txt>
            </View>
          </View>
        ))}
      </CardGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  row: { flexDirection: 'row', gap: space.sm, padding: space.md },
  text: { flex: 1, gap: 2 },
});
