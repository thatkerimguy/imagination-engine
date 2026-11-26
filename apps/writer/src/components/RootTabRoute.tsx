// `/folders` and `/search` deep links (bookmarks, App Links, breadcrumbs, tests): focus that tab
// in the root pager and settle on `/` — dismissTo pops back to the shell when it is already on
// the stack, or replaces this route when it is not, so the tabs never duplicate.
import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { routes, type TabKey } from '../routes.ts';
import { useTheme } from '../ui/theme.tsx';
import { setRootTab, tabIndexOf } from './root-tab.ts';

export function RootTabRoute({ tab }: { tab: TabKey }): ReactNode {
  const { colors } = useTheme();
  setRootTab(tabIndexOf(tab));
  useEffect(() => {
    router.dismissTo(routes.shelf);
  }, []);
  return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;
}
