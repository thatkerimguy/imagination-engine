// Folio bottom tab bar (Library · Notes · Search): 56dp on the canvas, a 1px hairline on top,
// a Feather glyph over an 11px label, accent tint when active — no pill, no blob. Rendered by the
// root layout under the Stack, only on tab screens (see tabForPath in routes.ts).
import { router, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_ROOTS, tabForPath, type TabKey } from '../routes.ts';
import { Glyph, type GlyphName } from '../ui/Glyph.tsx';
import { tapFeedback } from '../ui/haptics.ts';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { useTheme } from '../ui/theme.tsx';

export const TAB_BAR_HEIGHT = 56;

function go(from: TabKey, to: TabKey, href: string): void {
  tapFeedback();
  // Library is the stack root, and re-tapping your own tab returns to its root: both pop back to
  // the screen already on the stack. Other tabs swap in place, so hopping never piles screens up.
  if (href === '/' || from === to) router.dismissTo(href);
  else if (from === 'library') router.push(href);
  else router.replace(href);
}

export function FolioTabBar(): ReactNode {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const active = tabForPath(pathname);
  if (!active) return null;
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
            onPress={() => (on && tab.key !== 'notes' ? undefined : go(active, tab.key, tab.href))}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tab.label}
            wash={null}
            testID={`tab-${tab.key}`}
          >
            <Glyph name={tab.icon as GlyphName} size={20} color={tint} />
            <Txt variant="meta" color={tint} style={[styles.label, on && styles.on]}>
              {tab.label}
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
