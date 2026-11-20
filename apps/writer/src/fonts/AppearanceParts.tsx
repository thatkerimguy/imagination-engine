// Presentational pieces of the Appearance screen: prose preview, theme swatch, value stepper.
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '../ui/AppText.tsx';
import { Icon } from '../ui/Icon.tsx';
import { IconButton } from '../ui/IconButton.tsx';
import { Card } from '../ui/layout.tsx';
import { useTheme, useWriterPrefs } from '../ui/theme.tsx';
import type { ThemeDef } from '../ui/themes.ts';
import { MARGIN_DP } from '../ui/typography.ts';
import { useFontFamily } from './loader';

const SAMPLE_PROSE = [
  'The lantern guttered as Mara stepped onto the pier, and the whole harbour seemed to hold its breath.',
  '"You came," said the voice from the fog. "I did not think you would."',
];

export function Preview(): ReactNode {
  const [p] = useWriterPrefs();
  const family = useFontFamily(p.fontId);
  const { m3 } = useTheme();
  return (
    <Card variant="outlined">
      <View
        testID="appearance-preview"
        style={{ paddingHorizontal: MARGIN_DP[p.marginPreset], paddingVertical: 8 }}
      >
        {SAMPLE_PROSE.map((t, i) => (
          <AppText
            key={t}
            style={{
              fontFamily: family,
              fontSize: p.fontSize,
              lineHeight: Math.round(p.fontSize * p.lineHeight),
              textAlign: p.defaultAlign,
              color: m3.onSurface,
              marginTop: i ? 8 : 0,
            }}
          >
            {p.firstLineIndent ? `\u2003\u2003${t}` : t}
          </AppText>
        ))}
      </View>
    </Card>
  );
}

export function Swatch({
  t,
  selected,
  onPress,
}: {
  t: ThemeDef;
  selected: boolean;
  onPress(): void;
}): ReactNode {
  const { m3 } = useTheme();
  return (
    <Pressable
      testID={`theme-${t.id}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={t.label}
      onPress={onPress}
      style={{
        width: '47%',
        padding: 10,
        borderRadius: 12,
        backgroundColor: t.m3.surface,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? m3.primary : m3.outlineVariant,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <View
          style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: t.m3.primary }}
        />
        <View
          style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: t.m3.tertiary }}
        />
        <View style={{ flex: 1 }} />
        {selected ? <Icon name="check" size={18} color="primary" /> : null}
      </View>
      <AppText
        variant="labelMedium"
        numberOfLines={1}
        style={{ color: t.m3.onSurface, marginTop: 6 }}
      >
        {t.label}
      </AppText>
    </Pressable>
  );
}

export function Stepper(p: {
  label: string;
  value: string;
  onDec(): void;
  onInc(): void;
  testID: string;
}): ReactNode {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <AppText variant="bodyLarge">{p.label}</AppText>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconButton
          icon="remove"
          accessibilityLabel={`Decrease ${p.label}`}
          testID={`${p.testID}-dec`}
          onPress={p.onDec}
        />
        <AppText
          variant="titleMedium"
          testID={`${p.testID}-value`}
          style={{ minWidth: 44, textAlign: 'center' }}
        >
          {p.value}
        </AppText>
        <IconButton
          icon="add"
          accessibilityLabel={`Increase ${p.label}`}
          testID={`${p.testID}-inc`}
          onPress={p.onInc}
        />
      </View>
    </View>
  );
}
