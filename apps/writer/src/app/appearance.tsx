// Appearance & fonts: live prose preview, theme, font family, size, spacing and editor options.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { THEMES } from '../ui/themes.ts';
import { FontList } from '../fonts/FontList.tsx';
import { Preview, Stepper, Swatch } from '../fonts/AppearanceParts.tsx';
import {
  FONT_SIZE_RANGE,
  LINE_HEIGHT_RANGE,
  type MarginPreset,
  type TextAlign,
} from '../store/writer-prefs.ts';
import { AppText } from '../ui/AppText.tsx';
import { Chip } from '../ui/Chip.tsx';
import { Card, Muted, Row, Screen, SectionTitle } from '../ui/layout.tsx';
import { SegmentedButtons } from '../ui/SegmentedButtons.tsx';
import { Switch } from '../ui/Switch.tsx';
import { useWriterPrefs } from '../ui/theme.tsx';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export default function AppearanceScreen(): ReactNode {
  const [p, update] = useWriterPrefs();
  const swatches = (dark: boolean): ReactNode => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {THEMES.filter((t) => t.dark === dark).map((t) => (
        <Swatch
          key={t.id}
          t={t}
          selected={p.themeId === t.id}
          onPress={() => update({ themeId: t.id })}
        />
      ))}
    </View>
  );
  return (
    <Screen>
      <SectionTitle>Preview</SectionTitle>
      <Preview />
      <SectionTitle>Theme</SectionTitle>
      <Card>
        <Row>
          <Chip
            label="System"
            icon="brightness-auto"
            selected={p.themeId === 'system'}
            testID="theme-system"
            onPress={() => update({ themeId: 'system' })}
          />
        </Row>
        <AppText variant="labelLarge" color="onSurfaceVariant">
          Night
        </AppText>
        {swatches(true)}
        <AppText variant="labelLarge" color="onSurfaceVariant">
          Day
        </AppText>
        {swatches(false)}
      </Card>
      <SectionTitle>Font</SectionTitle>
      <Card>
        <FontList fontId={p.fontId} onSelect={(fontId) => update({ fontId })} />
      </Card>
      <SectionTitle>Text</SectionTitle>
      <Card>
        <Stepper
          label="Font size"
          testID="font-size"
          value={String(p.fontSize)}
          onDec={() =>
            update({ fontSize: clamp(p.fontSize - 1, FONT_SIZE_RANGE.min, FONT_SIZE_RANGE.max) })
          }
          onInc={() =>
            update({ fontSize: clamp(p.fontSize + 1, FONT_SIZE_RANGE.min, FONT_SIZE_RANGE.max) })
          }
        />
        <Stepper
          label="Line height"
          testID="line-height"
          value={p.lineHeight.toFixed(1)}
          onDec={() =>
            update({
              lineHeight: clamp(
                Math.round((p.lineHeight - 0.1) * 10) / 10,
                LINE_HEIGHT_RANGE.min,
                LINE_HEIGHT_RANGE.max,
              ),
            })
          }
          onInc={() =>
            update({
              lineHeight: clamp(
                Math.round((p.lineHeight + 0.1) * 10) / 10,
                LINE_HEIGHT_RANGE.min,
                LINE_HEIGHT_RANGE.max,
              ),
            })
          }
        />
        <AppText variant="bodyLarge">Margins</AppText>
        <SegmentedButtons<MarginPreset>
          accessibilityLabel="Margins"
          testID="margins"
          value={p.marginPreset}
          onChange={(marginPreset) => update({ marginPreset })}
          segments={[
            { value: 'compact', label: 'Compact' },
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'wide', label: 'Wide' },
          ]}
        />
        <AppText variant="bodyLarge">Default alignment</AppText>
        <SegmentedButtons<TextAlign>
          accessibilityLabel="Default alignment"
          testID="align"
          value={p.defaultAlign}
          onChange={(defaultAlign) => update({ defaultAlign })}
          segments={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ]}
        />
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <AppText variant="bodyLarge">First-line indent</AppText>
          <Switch
            testID="first-line-indent"
            accessibilityLabel="First-line indent"
            value={p.firstLineIndent}
            onValueChange={(firstLineIndent) => update({ firstLineIndent })}
          />
        </View>
      </Card>
      <SectionTitle>Keyboard</SectionTitle>
      <Card>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <AppText variant="bodyLarge">Samsung IME Safe Mode</AppText>
          <Switch
            testID="samsung-safe-ime"
            accessibilityLabel="Samsung IME Safe Mode"
            value={p.samsungSafeIme}
            onValueChange={(samsungSafeIme) => update({ samsungSafeIme })}
          />
        </View>
        <Muted>
          Turns off autocorrect and spellcheck so Samsung Keyboard stops duplicating text.
        </Muted>
      </Card>
    </Screen>
  );
}
