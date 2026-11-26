// Folio navigation rail (Medium / Expanded windows, >= 600 dp): the bottom tab bar's Library ·
// Notes · Search destinations as a quiet vertical rail on the left, 80 dp wide with a hairline
// edge, respecting the top / left / bottom insets. Same routing as FolioTabBar (tabNavigate → RootTabsPager).
import { usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { routes, TAB_ROOTS } from '../routes.ts';
import { Glyph, type GlyphName } from '../ui/Glyph.tsx';
import { Press } from '../ui/Press.tsx';
import { space } from '../ui/tokens.ts';
import { Txt } from '../ui/Txt.tsx';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { useTheme } from '../ui/theme.tsx';
import { tabNavigate, useActiveTab } from './FolioTabBar.tsx';

export const NAV_RAIL_WIDTH = 80;

export function FolioNavRail(): ReactNode {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useI18n();
  const active = useActiveTab(pathname);
  if (!active) return null;
  return (
    <View
      style={[
        styles.rail,
        {
          width: NAV_RAIL_WIDTH + insets.left,
          paddingTop: insets.top + space.md,
          paddingLeft: insets.left,
          paddingBottom: insets.bottom,
          backgroundColor: colors.canvas,
          borderColor: colors.hairline,
        },
      ]}
      accessibilityRole="tablist"
      testID="nav-rail"
    >
      {TAB_ROOTS.map((tab) => {
        const on = tab.key === active;
        const tint = on ? 'accent' : 'inkMuted';
        return (
          <Press
            key={tab.key}
            style={styles.item}
            onPress={() =>
              on && pathname === routes.shelf ? undefined : tabNavigate(tab.key, pathname)
            }
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            aria-selected={on}
            accessibilityLabel={t(`tab.${tab.key}`)}
            wash={null}
            testID={`rail-${tab.key}`}
          >
            <View style={[styles.indicator, on && { backgroundColor: colors.accentSoft }]}>
              <Glyph name={tab.icon as GlyphName} size={22} color={tint} />
            </View>
            <Txt variant="meta" color={tint} style={[styles.label, on && styles.on]}>
              {t(`tab.${tab.key}`)}
            </Txt>
          </Press>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { borderRightWidth: 1, alignItems: 'center', gap: space.sm },
  item: { width: NAV_RAIL_WIDTH, minHeight: 64, alignItems: 'center', justifyContent: 'center' },
  indicator: {
    width: 56,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 12, lineHeight: 16, letterSpacing: 0.2, marginTop: 4 },
  on: { fontWeight: '600' },
});
