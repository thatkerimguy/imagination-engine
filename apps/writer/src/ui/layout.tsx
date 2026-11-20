// Themed layout pieces shared by every screen: Screen, Card, SectionTitle, Row, StatusBadge,
// IconBadge and EmptyState.
import type { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { AppText } from './AppText.tsx';
import { Icon, type IconName } from './Icon.tsx';
import { shape, space, type ColorRoles } from './m3-tokens.ts';
import { makeStyles, useTheme } from './theme.tsx';

/** Scrolling screen body on the M3 surface, with room for a FAB or bottom bar. */
export function Screen({
  children,
  contentStyle,
  ...rest
}: ScrollViewProps & { contentStyle?: StyleProp<ViewStyle> }): ReactNode {
  const s = useStyles();
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

export type CardVariant = 'filled' | 'elevated' | 'outlined';

export function Card({
  children,
  variant = 'filled',
  style,
}: {
  children: ReactNode;
  variant?: CardVariant;
  style?: StyleProp<ViewStyle>;
}): ReactNode {
  const s = useStyles();
  return <View style={[s.card, s[variant], style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }): ReactNode {
  const s = useStyles();
  return (
    <AppText variant="titleSmall" color="primary" style={s.section} accessibilityRole="header">
      {children}
    </AppText>
  );
}

export function Muted({ children }: { children: ReactNode }): ReactNode {
  return (
    <AppText variant="bodyMedium" color="onSurfaceVariant">
      {children}
    </AppText>
  );
}

/** Wrapping row with consistent gaps, for chip groups and button rows. */
export function Row({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}): ReactNode {
  return <View style={[styles.row, style]}>{children}</View>;
}

export type BadgeTone = 'neutral' | 'primary' | 'tertiary' | 'error';

const TONES: Record<BadgeTone, [keyof ColorRoles, keyof ColorRoles]> = {
  neutral: ['surfaceContainerHighest', 'onSurfaceVariant'],
  primary: ['primaryContainer', 'onPrimaryContainer'],
  tertiary: ['tertiaryContainer', 'onTertiaryContainer'],
  error: ['errorContainer', 'onErrorContainer'],
};

/** Compact tonal label (status, module badge). Not interactive. */
export function StatusBadge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
}): ReactNode {
  const { colors } = useTheme();
  const [bg, fg] = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors[bg] }]}>
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <AppText variant="labelSmall" color={fg}>
        {label}
      </AppText>
    </View>
  );
}

/** 40dp tonal container for a module's emoji icon (schema `meta.icon`) or a monogram. */
export function IconBadge({
  glyph,
  size = 40,
  tone = 'secondary',
}: {
  glyph: string;
  size?: number;
  tone?: 'secondary' | 'primary' | 'tertiary';
}): ReactNode {
  const { colors } = useTheme();
  const bg = colors[`${tone}Container`];
  const fg = colors[`on${tone[0]!.toUpperCase()}${tone.slice(1)}Container` as keyof ColorRoles];
  return (
    <View
      style={[styles.iconBadge, { width: size, height: size, backgroundColor: bg }]}
      accessible={false}
    >
      <Text style={{ fontSize: size * 0.5, color: fg, fontWeight: '600' }}>{glyph}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  body,
  icon,
  action,
}: {
  title: string;
  body?: string;
  icon?: IconName;
  action?: ReactNode;
}): ReactNode {
  return (
    <View style={styles.empty}>
      {icon ? <Icon name={icon} size={48} color="onSurfaceVariant" /> : null}
      <AppText variant="titleMedium" style={styles.center}>
        {title}
      </AppText>
      {body ? (
        <AppText variant="bodyMedium" color="onSurfaceVariant" style={styles.center}>
          {body}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.surface },
  content: { padding: space.lg, gap: space.md, paddingBottom: 120 },
  card: { borderRadius: shape.medium, padding: space.lg, gap: space.sm },
  filled: { backgroundColor: t.colors.surfaceContainer },
  elevated: {
    backgroundColor: t.colors.surfaceContainerLow,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  outlined: {
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.outlineVariant,
  },
  section: { marginTop: space.md },
}));

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: shape.small,
    paddingHorizontal: 8,
    height: 24,
  },
  iconBadge: { borderRadius: shape.medium, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: space.xl, alignItems: 'center', gap: space.md },
  center: { textAlign: 'center' },
});
