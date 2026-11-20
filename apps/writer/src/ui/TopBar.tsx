// Folio top bar: slim 52dp on the canvas, 44dp back glyph, quiet title (or a custom slot) and
// quiet trailing icon buttons. A hairline appears underneath only while the page is scrolled.
// StackTopBar is the Stack's custom header, so every screen shares one bar and a working Back.
import type { NativeStackHeaderProps } from 'expo-router/native-stack';
import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parentHref } from '../routes.ts';
import { useHeaderScrolled } from './header-scroll.tsx';
import { IconBtn } from './IconBtn.tsx';
import { Txt } from './Txt.tsx';
import { space } from './tokens.ts';
import { useTheme } from './theme.tsx';

export const TOP_BAR_HEIGHT = 52;

export function StackTopBar({ options, navigation }: NativeStackHeaderProps): ReactNode {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const scrolled = useHeaderScrolled();
  const parent = parentHref(pathname, params);
  const title = typeof options.title === 'string' ? options.title : '';
  const actions = options.headerRight?.({ canGoBack: parent !== null });
  const onBack =
    parent === null
      ? undefined
      : () => (navigation.canGoBack() ? navigation.goBack() : router.replace(parent));
  return <TopBar title={title} onBack={onBack} actions={actions} scrolled={scrolled} />;
}

export interface TopBarProps {
  title?: string;
  /** Replaces the title text (e.g. word count + save state in the editor). */
  titleSlot?: ReactNode;
  onBack?: () => void;
  actions?: ReactNode;
  /** Shows the bottom hairline (content scrolled under the bar). */
  scrolled?: boolean;
  /** Serif display title (Library) instead of the quiet sans bar title. */
  display?: boolean;
  testID?: string;
}

export function TopBar(p: TopBarProps): ReactNode {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: colors.canvas,
        borderBottomWidth: 1,
        borderColor: p.scrolled ? colors.hairline : 'transparent',
      }}
      testID={p.testID}
    >
      <View style={styles.row}>
        {p.onBack ? (
          <IconBtn
            icon="arrow-left"
            accessibilityLabel="Back"
            onPress={p.onBack}
            testID="top-bar-back"
            color="ink"
          />
        ) : (
          <View style={styles.inset} />
        )}
        <View style={styles.title}>
          {p.titleSlot ?? (
            <Txt
              variant={p.display ? 'title' : 'bodyStrong'}
              numberOfLines={1}
              accessibilityRole="header"
            >
              {p.title}
            </Txt>
          )}
        </View>
        {p.actions ? <View style={styles.actions}>{p.actions}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: TOP_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xxs,
  },
  inset: { width: space.md },
  title: { flex: 1, marginLeft: space.xxs, justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', paddingRight: space.xxs },
});
