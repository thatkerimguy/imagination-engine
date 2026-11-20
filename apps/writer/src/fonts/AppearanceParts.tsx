// Presentational pieces of the Appearance screen: the live paper preview and theme swatches.
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { lift, radius, space } from '../ui/tokens.ts';
import { Txt } from '../ui/Txt.tsx';
import { useTheme, useWriterPrefs } from '../ui/theme.tsx';
import type { ThemeDef } from '../ui/themes.ts';
import { serif } from '../ui/type.ts';
import { MARGIN_DP } from '../ui/typography.ts';
import { useFontFamily } from './loader';

const TITLE = 'Chapter One';
const PROSE =
  'The lantern guttered as Mara stepped onto the pier, and the whole harbour seemed to hold its breath.';
const DIALOGUE = '“You came,” said the voice from the fog. “I did not think you would.”';

/** A miniature manuscript page in the active theme, font, size, spacing, margins and indent. */
export function PaperPreview(): ReactNode {
  const [p] = useWriterPrefs();
  const family = useFontFamily(p.fontId);
  const { colors, dark } = useTheme();
  const lineHeight = Math.round(p.fontSize * p.lineHeight);
  const indent = p.firstLineIndent ? '  ' : '';
  const body = {
    fontFamily: family,
    fontSize: p.fontSize,
    lineHeight,
    textAlign: p.defaultAlign,
    color: colors.ink,
  } as const;
  return (
    <View
      testID="appearance-preview"
      style={[
        {
          backgroundColor: colors.canvas,
          borderColor: colors.hairline,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: MARGIN_DP[p.marginPreset] + space.xs,
          paddingVertical: space.lg,
          gap: Math.round(p.fontSize * 0.5),
        },
        lift(dark),
      ]}
    >
      <Txt
        style={{
          ...body,
          fontSize: Math.round(p.fontSize * 1.3),
          lineHeight: Math.round(p.fontSize * 1.3 * 1.25),
          fontWeight: '600',
          textAlign: p.defaultAlign,
        }}
      >
        {TITLE}
      </Txt>
      <Txt style={body}>{`${indent}${PROSE}`}</Txt>
      <Txt style={body}>{`${indent}${DIALOGUE}`}</Txt>
    </View>
  );
}

/** A tiny book page in the swatch theme's colours: canvas, serif "Aa" in its ink, accent bar. */
export function Swatch({
  t,
  selected,
  onPress,
}: {
  t: ThemeDef;
  selected: boolean;
  onPress(): void;
}): ReactNode {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={`theme-${t.id}`}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={t.label}
      onPress={onPress}
      style={{ width: '31%', gap: 6 }}
    >
      <View
        style={{
          padding: 2,
          borderRadius: radius.sm + 2,
          borderWidth: 2,
          borderColor: selected ? colors.accent : 'transparent',
        }}
      >
        <View
          style={{
            height: 72,
            borderRadius: radius.sm,
            backgroundColor: t.colors.canvas,
            borderWidth: 1,
            borderColor: t.colors.borderStrong,
            justifyContent: 'space-between',
            padding: space.sm,
          }}
        >
          <Txt style={{ fontFamily: serif, fontSize: 24, lineHeight: 28, color: t.colors.ink }}>
            Aa
          </Txt>
          <View
            style={{ width: 22, height: 3, borderRadius: 2, backgroundColor: t.colors.accent }}
          />
        </View>
      </View>
      <Txt
        variant="caption"
        numberOfLines={1}
        color={selected ? 'ink' : 'inkSecondary'}
        style={{ textAlign: 'center', fontWeight: selected ? '600' : '400' }}
      >
        {t.label}
      </Txt>
    </Pressable>
  );
}
