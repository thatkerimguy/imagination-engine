// Calm two-option workspace picker (Classic Novel / Interactive Studio) shared by New Novel and
// Book Settings. Radio rows inside a Folio card; the selected row is marked with the accent.
import type { WorkspaceMode } from '@kn/core';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { CardGroup } from '../ui/CardGroup.tsx';
import { Glyph, type GlyphName } from '../ui/Glyph.tsx';
import { tapFeedback } from '../ui/haptics.ts';
import { Press } from '../ui/Press.tsx';
import { space } from '../ui/tokens.ts';
import { Txt } from '../ui/Txt.tsx';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { MODE_CHOICES } from './mode-policy.ts';

const ICONS: Record<WorkspaceMode, GlyphName> = { prose: 'feather', interactive: 'zap' };

export interface ModePickerProps {
  value: WorkspaceMode;
  onChange(mode: WorkspaceMode): void;
  testID?: string;
}

export function ModePicker({ value, onChange, testID }: ModePickerProps): ReactNode {
  const { t } = useI18n();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('novel.workspaceMode')}
      testID={testID}
    >
      <CardGroup>
        {MODE_CHOICES.map((c) => {
          const on = c.mode === value;
          return (
            <Press
              key={c.mode}
              accessibilityRole="radio"
              accessibilityLabel={`${t(c.labelKey)}. ${t(c.hintKey)}`}
              accessibilityState={{ selected: on, checked: on }}
              aria-checked={on}
              testID={`mode-option-${c.mode}`}
              onPress={() => {
                if (on) return;
                tapFeedback();
                onChange(c.mode);
              }}
              style={styles.row}
            >
              <Glyph name={ICONS[c.mode]} size={20} color={on ? 'accent' : 'inkSecondary'} />
              <View style={styles.text}>
                <Txt variant="body" color={on ? 'accent' : 'ink'}>
                  {t(c.labelKey)}
                </Txt>
                <Txt variant="meta" color="inkSecondary">
                  {t(c.hintKey)}
                </Txt>
              </View>
            </Press>
          );
        })}
      </CardGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: 56,
  },
  text: { flex: 1, gap: 2 },
});
