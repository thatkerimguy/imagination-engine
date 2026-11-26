// Presentational pieces of the Appearance screen: the live paper preview and theme swatches.
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { CardGroup } from '../ui/CardGroup.tsx';
import { ListRow } from '../ui/Page.tsx';
import { SegmentControl, type SegmentOption } from '../ui/SegmentControl.tsx';
import { Toggle } from '../ui/Toggle.tsx';
import { lift, radius, space } from '../ui/tokens.ts';
import { Txt } from '../ui/Txt.tsx';
import { useMaterialYou, useTheme, useWriterPrefs } from '../ui/theme.tsx';
import type { ThemeDef, ThemeId } from '../ui/themes.ts';
import type { WriterPrefs } from '../store/writer-prefs.ts';
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

const STYLE_OPTIONS: readonly SegmentOption<WriterPrefs['materialYouStyle']>[] = [
  { value: 'soft', label: 'Soft tint', testID: 'material-you-style-soft' },
  { value: 'exact', label: 'Exact wallpaper', testID: 'material-you-style-exact' },
];

/** Three crisp colour dots (canvas, surface, accent) with a hairline ring. */
function SwatchDots({ colors }: { colors: readonly string[] }): ReactNode {
  const { colors: ui } = useTheme();
  return (
    <View testID="material-you-swatch" style={{ flexDirection: 'row', gap: 4 }}>
      {colors.map((c, i) => (
        <View
          key={i}
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: c,
            borderWidth: 1,
            borderColor: ui.hairline,
          }}
        />
      ))}
    </View>
  );
}

/** "Match phone theme" toggle card with wallpaper dots and the Soft / Exact style switch. */
export function MatchPhoneThemeCard({ currentId }: { currentId: ThemeId }): ReactNode {
  const [p, update] = useWriterPrefs();
  const { active, swatch } = useMaterialYou();
  const { colors } = useTheme();
  const on = p.themeId === 'system';
  const dots = active && swatch ? swatch : colors;
  return (
    <CardGroup>
      <ListRow
        last
        title="Match phone theme"
        subtitle={active ? 'From your phone wallpaper' : 'Follows device light or dark mode'}
        trailing={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <SwatchDots colors={[dots.canvas, dots.surface, dots.accent]} />
            <Toggle
              testID="theme-system"
              accessibilityLabel="Match phone theme"
              value={on}
              onValueChange={(v) => update({ themeId: v ? 'system' : currentId })}
            />
          </View>
        }
      />
      {on ? (
        <View style={{ paddingVertical: space.sm, paddingHorizontal: space.md }}>
          <SegmentControl<WriterPrefs['materialYouStyle']>
            options={STYLE_OPTIONS}
            value={p.materialYouStyle}
            onChange={(materialYouStyle) => update({ materialYouStyle })}
            accessibilityLabel="Wallpaper colour style"
            testID="material-you-style"
          />
        </View>
      ) : null}
    </CardGroup>
  );
}
