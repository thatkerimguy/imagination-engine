// Folio bottom tab bar (Library · Notes · Search): 56dp on the canvas, a 1px hairline on top,
// a Feather glyph over an 11px label, accent tint when active — no pill, no blob. Rendered by the
// root layout under the Stack, only on tab screens (see tabForPath in routes.ts) of Compact
// windows; Medium / Expanded windows get FolioNavRail instead.
import { router, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { routes, TAB_ROOTS, tabForPath, type TabKey } from '../routes.ts';
import { Glyph, type GlyphName } from '../ui/Glyph.tsx';
import { tapFeedback } from '../ui/haptics.ts';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { usesRail } from '../ui/layout-class.ts';
import { useLayoutClass } from '../ui/use-layout-class.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { useTheme } from '../ui/theme.tsx';
import { setRootTab, tabIndexOf, tabKeyAt, useRootTab } from './root-tab.ts';

export const TAB_BAR_HEIGHT = 56;

/**
 * Library, Notes and Search share the `/` pager (RootTabsPager): a tap moves the pager, and from a
 * sub-folder pops back to the shell, so hopping between tabs never piles screens up.
 */
export function tabNavigate(to: TabKey, pathname: string): void {
  tapFeedback();
  setRootTab(tabIndexOf(to));
  if (pathname !== routes.shelf) router.dismissTo(routes.shelf);
}

/** The highlighted tab: the pager's page on `/`, else the route's own tab (sub-folders → Notes). */
export function useActiveTab(pathname: string): TabKey | null {
  const page = useRootTab();
  return pathname === routes.shelf ? tabKeyAt(page) : tabForPath(pathname);
}

export function FolioTabBar(): ReactNode {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { t } = useI18n();
  const active = useActiveTab(pathname);
  const rail = usesRail(useLayoutClass());
  if (!active || rail) return null;
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.canvas,
          borderColor: colors.hairline,
          paddingBottom: insets.bottom,
        },
      ]}
      accessibilityRole="tablist"
      testID="tab-bar"
    >
      {TAB_ROOTS.map((tab) => {
        const on = tab.key === active;
        const tint = on ? 'accent' : 'inkMuted';
        return (
          <Press
            key={tab.key}
            style={styles.tab}
            onPress={() =>
              on && pathname === routes.shelf ? undefined : tabNavigate(tab.key, pathname)
            }
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            aria-selected={on}
            accessibilityLabel={t(`tab.${tab.key}`)}
            wash={null}
            testID={`tab-${tab.key}`}
          >
            <Glyph name={tab.icon as GlyphName} size={20} color={tint} />
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
  bar: { flexDirection: 'row', borderTopWidth: 1 },
  tab: { flex: 1, height: TAB_BAR_HEIGHT, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 11, lineHeight: 14, letterSpacing: 0.2 },
  on: { fontWeight: '600' },
});
