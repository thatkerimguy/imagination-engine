// Gimmick Module Guide, generated from the module registry (no per-module copy).
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { writerModules } from '../modules/registry.ts';
import { CardGroup } from '../ui/CardGroup.tsx';
import { Glyph } from '../ui/Glyph.tsx';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { SectionLabel } from '../ui/Page.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { GENRE_ICON, GENRE_LABEL, LAYER_TRIGGER, MODULE_GENRE_OVERRIDE } from './help-content.ts';

export function GimmickGuideSection(): ReactNode {
  const { t } = useI18n();
  return (
    <View style={styles.section} testID="help-gimmick-guide">
      <SectionLabel>{t('help.gimmicks')}</SectionLabel>
      <CardGroup>
        {writerModules.map(({ meta }) => {
          const over = MODULE_GENRE_OVERRIDE[meta.id];
          return (
            <View key={meta.id} style={styles.row} testID={`help-module-${meta.id}`}>
              <Glyph name={over?.icon ?? GENRE_ICON[meta.genre]} size={20} color="accent" />
              <View style={styles.text}>
                <Txt variant="bodyStrong">{meta.name}</Txt>
                <Txt variant="caption" color="inkMuted">
                  {over?.label ?? GENRE_LABEL[meta.genre]}
                </Txt>
                <Txt variant="meta" color="inkSecondary">
                  {meta.description}
                </Txt>
                <Txt variant="meta" color="inkMuted">
                  {LAYER_TRIGGER[meta.layer]}
                </Txt>
              </View>
            </View>
          );
        })}
      </CardGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  row: { flexDirection: 'row', gap: space.sm, padding: space.md },
  text: { flex: 1, gap: 2 },
});
