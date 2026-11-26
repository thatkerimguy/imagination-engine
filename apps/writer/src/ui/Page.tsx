// Folio page furniture: Page (scrolling canvas with 20dp gutters), Divider, SectionLabel
// (tracked small caps + hairline rule), ListRow (grouped hairline settings row), Dot and
// EmptyState. Hairlines and type do the work — no heavy cards.
import { useRef, type ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewInstance,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useKeyboardDock } from '../editor/use-keyboard-dock.ts';
import { useCardInset } from './CardGroup.tsx';
import { Glyph, type GlyphName } from './Glyph.tsx';
import { useScrollReporter } from './header-scroll.tsx';
import { READING_MAX } from './layout-class.ts';
import { useLayoutClass } from './use-layout-class.ts';
import { Press } from './Press.tsx';
import { Txt } from './Txt.tsx';
import { space } from './tokens.ts';
import { useTheme } from './theme.tsx';
import { useImeReveal } from './use-ime-reveal.ts';

const BOTTOM_PAD = 96;

export function Page({
  children,
  contentStyle,
  onLayout,
  wide = false,
  ...rest
}: ScrollViewProps & {
  contentStyle?: StyleProp<ViewStyle>;
  /** Grids opt out of the 720 dp readable measure on Medium / Expanded windows. */
  wide?: boolean;
}): ReactNode {
  const { colors } = useTheme();
  const onScroll = useScrollReporter();
  const scroll = useRef<ScrollViewInstance>(null);
  const trackY = useImeReveal(scroll);
  const cls = useLayoutClass();
  const measure = !wide && cls !== 'compact' ? styles.measure : null;
  // Android 15+/16 edge-to-edge windows do not resize for the IME, so bottom form fields
  // (Settings URL/token, Lock, New novel) need keyboard-height clearance; useImeReveal then
  // scrolls the focused field above the keyboard. Insets are untouched (no double-counting).
  const { keyboardOffset, onRootLayout } = useKeyboardDock();
  const kbPad =
    Platform.OS === 'android' && keyboardOffset > 0
      ? { paddingBottom: Math.max(BOTTOM_PAD, keyboardOffset + space.xl) }
      : null;
  return (
    <ScrollView
      ref={scroll}
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={[styles.content, measure, contentStyle, kbPad]}
      keyboardShouldPersistTaps="handled"
      onScroll={(e) => {
        trackY(e);
        onScroll(e);
      }}
      scrollEventThrottle={32}
      onLayout={(e) => {
        onRootLayout(e);
        onLayout?.(e);
      }}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

export function Divider({ inset = 0 }: { inset?: number }): ReactNode {
  const { colors } = useTheme();
  return <View style={{ height: 1, marginLeft: inset, backgroundColor: colors.hairline }} />;
}

/** `SEASON 1 · LOW TIDE` — tracked small caps, a hairline rule and an optional trailing slot. */
export function SectionLabel({
  children,
  trailing,
  style,
}: {
  children: ReactNode;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
}): ReactNode {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, style]}>
      <Txt variant="overline" color="inkSecondary" accessibilityRole="header" numberOfLines={1}>
        {children}
      </Txt>
      <View style={[styles.rule, { backgroundColor: colors.hairline }]} />
      {trailing}
    </View>
  );
}

export interface ListRowProps {
  title: string;
  /** Quiet second line. */
  subtitle?: string;
  /** Right-aligned muted value (e.g. "Warm Sepia"). */
  detail?: string;
  /** Leading glyph. */
  icon?: GlyphName;
  /** Trailing control (Toggle, etc.). Defaults to a chevron when onPress is set. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Hide the bottom hairline (last row of a group). */
  last?: boolean;
  destructive?: boolean;
  testID?: string;
}

export function ListRow(p: ListRowProps): ReactNode {
  const { colors } = useTheme();
  const body = (
    <>
      {p.icon ? <Glyph name={p.icon} size={18} color={p.destructive ? 'danger' : 'ink'} /> : null}
      <View style={styles.rowText}>
        <Txt variant="body" color={p.destructive ? 'danger' : 'ink'} numberOfLines={1}>
          {p.title}
        </Txt>
        {p.subtitle ? (
          <Txt variant="meta" color="inkSecondary" numberOfLines={2}>
            {p.subtitle}
          </Txt>
        ) : null}
      </View>
      {p.detail ? (
        <Txt variant="meta" color="inkMuted" numberOfLines={1}>
          {p.detail}
        </Txt>
      ) : null}
      {p.trailing ?? (p.onPress ? <Glyph name="chevron-right" size={18} color="inkMuted" /> : null)}
    </>
  );
  const inset = useCardInset();
  const style = [
    styles.row,
    inset && styles.rowInset,
    !p.last && { borderBottomWidth: 1, borderColor: colors.hairline },
  ];
  return p.onPress ? (
    <Press
      accessibilityRole="button"
      accessibilityLabel={p.title}
      onPress={p.onPress}
      testID={p.testID}
      style={style}
    >
      {body}
    </Press>
  ) : (
    <View style={style} testID={p.testID}>
      {body}
    </View>
  );
}

/** Small status / accent dot. */
export function Dot({ color, size = 6 }: { color: string; size?: number }): ReactNode {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
  );
}

export function EmptyState(p: {
  title: string;
  body?: string;
  icon?: GlyphName;
  action?: ReactNode;
}): ReactNode {
  return (
    <View style={styles.empty}>
      {p.icon ? <Glyph name={p.icon} size={28} color="inkMuted" /> : null}
      <Txt variant="title" style={styles.center}>
        {p.title}
      </Txt>
      {p.body ? (
        <Txt variant="body" color="inkSecondary" style={styles.center}>
          {p.body}
        </Txt>
      ) : null}
      {p.action}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.gutter,
    paddingTop: space.xs,
    paddingBottom: BOTTOM_PAD,
    gap: space.md,
  },
  measure: { width: '100%', maxWidth: READING_MAX, alignSelf: 'center' },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44,
    marginTop: space.xs,
  },
  rule: { flex: 1, height: 1 },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  rowInset: { paddingHorizontal: space.md },
  rowText: { flex: 1, gap: 2 },
  empty: {
    paddingVertical: space.xxl * 2,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    gap: space.sm,
  },
  center: { textAlign: 'center' },
});
