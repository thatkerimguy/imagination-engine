// M3 small top app bar: 64dp + safe area, 48dp leading Back, titleLarge, trailing actions.
// Used as the Stack's custom header, so every screen gets the same bar and a working Back.
import type { NativeStackHeaderProps } from 'expo-router/native-stack';
import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parentHref } from '../routes.ts';
import { AppText } from './AppText.tsx';
import { IconButton } from './IconButton.tsx';
import { space } from './m3-tokens.ts';
import { useTheme } from './theme.tsx';

export function StackTopBar({ options, navigation }: NativeStackHeaderProps): ReactNode {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const parent = parentHref(pathname, params);
  const title = typeof options.title === 'string' ? options.title : '';
  const actions = options.headerRight?.({ canGoBack: parent !== null });
  const onBack =
    parent === null
      ? undefined
      : () => (navigation.canGoBack() ? navigation.goBack() : router.replace(parent));
  return <TopBar title={title} onBack={onBack} actions={actions} />;
}

export interface TopBarProps {
  title: string;
  onBack?: () => void;
  actions?: ReactNode;
}

export function TopBar({ title, onBack, actions }: TopBarProps): ReactNode {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View style={[styles.bar, { paddingTop: insets.top, backgroundColor: colors.surface }]}>
      <View style={styles.row}>
        {onBack ? (
          <IconButton
            icon="arrow-back"
            accessibilityLabel="Back"
            onPress={onBack}
            testID="top-bar-back"
            color="onSurface"
          />
        ) : (
          <View style={styles.inset} />
        )}
        <AppText
          variant="titleLarge"
          numberOfLines={1}
          style={styles.title}
          accessibilityRole="header"
        >
          {title}
        </AppText>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {},
  row: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xs,
    gap: space.xs,
  },
  inset: { width: space.md },
  title: { flex: 1, marginLeft: space.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingRight: space.xs },
});
