// Folio page furniture: Page (scrolling canvas with 20dp gutters), Divider, SectionLabel
// (tracked small caps + hairline rule), ListRow (grouped hairline settings row), Dot and
// EmptyState. Hairlines and type do the work — no heavy cards.
import type { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Glyph, type GlyphName } from './Glyph.tsx';
import { useScrollReporter } from './header-scroll.tsx';
import { Press } from './Press.tsx';
import { Txt } from './Txt.tsx';
import { space } from './tokens.ts';
import { useTheme } from './theme.tsx';

export function Page({
  children,
  contentStyle,
  ...rest
}: ScrollViewProps & { contentStyle?: StyleProp<ViewStyle> }): ReactNode {
  const { colors } = useTheme();
  const onScroll = useScrollReporter();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      onScroll={onScroll}
      scrollEventThrottle={32}
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
  const style = [styles.row, !p.last && { borderBottomWidth: 1, borderColor: colors.hairline }];
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
    paddingBottom: 96,
    gap: space.md,
  },
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
  rowText: { flex: 1, gap: 2 },
  empty: {
    paddingVertical: space.xxl * 2,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    gap: space.sm,
  },
  center: { textAlign: 'center' },
});
