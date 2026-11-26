import type { NativeStackHeaderProps } from 'expo-router/native-stack';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FolioNavRail } from '../components/FolioNavRail.tsx';
import { FolioTabBar } from '../components/FolioTabBar.tsx';
import { useCrashReporting } from '../observability/reporter.ts';
import { LockGate } from '../security/LockGate.tsx';
import { I18nProvider, useI18n } from '../i18n/I18nProvider.tsx';
import { recordActiveDayAsync } from '../settings/review-request';
import { RepositoryProvider, useRepository } from '../store/context.tsx';
import { ConfirmProvider } from '../ui/ConfirmDialog.tsx';
import { MotionProviders } from '../ui/MotionProviders';
import { ThemeProvider, useTheme } from '../ui/theme.tsx';
import { THEATER_BG } from '../ui/theater.ts';
import { StackTopBar } from '../ui/TopBar.tsx';
import { usesRail } from '../ui/layout-class.ts';
import { useLayoutClass } from '../ui/use-layout-class.ts';
import { useNavigationBarStyle } from '../ui/system-bars.ts';
import { useReduceMotion } from '../ui/use-reduce-motion.ts';
import { installWebFocusReset } from '../ui/web-focus.ts';

installWebFocusReset();

// Hoisted so React Navigation sees a stable header renderer and never remounts the chrome.
const renderHeader = (props: NativeStackHeaderProps): ReactNode => <StackTopBar {...props} />;

// Drill-down screens slide in from the right (iOS uses its native push curve); Android "Remove
// animations" / iOS Reduce Motion falls back to a calm cross-fade. Every screen paints the theme
// canvas so dark mode never flashes white mid-transition.
const PUSH = Platform.OS === 'ios' ? 'ios_from_right' : 'slide_from_right';

export default function RootLayout(): ReactNode {
  return (
    <MotionProviders>
      <SafeAreaProvider>
        <RepositoryProvider>
          <I18nProvider>
            <ThemeProvider>
              <ConfirmProvider>
                <LockGate>
                  <ThemedStack />
                </LockGate>
              </ConfirmProvider>
            </ThemeProvider>
          </I18nProvider>
        </RepositoryProvider>
      </SafeAreaProvider>
    </MotionProviders>
  );
}

function ThemedStack(): ReactNode {
  const { dark, colors } = useTheme();
  useNavigationBarStyle(!dark);
  useCrashReporting();
  const { t } = useI18n();
  const repo = useRepository();
  useEffect(() => {
    void recordActiveDayAsync(repo);
  }, [repo]);
  const rail = usesRail(useLayoutClass());
  const reduced = useReduceMotion();
  // The Stack keeps the same tree position in every layout class, so folding, unfolding or
  // rotating never remounts a screen (an open Chapter Editor keeps its draft and undo history).
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.canvas }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {rail ? <FolioNavRail /> : null}
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            header: renderHeader,
            contentStyle: { backgroundColor: colors.canvas },
            animation: reduced ? 'fade' : PUSH,
          }}
        >
          {/* Root tab shell: tabs switch inside RootTabsPager, never by a stack push. */}
          <Stack.Screen name="index" options={{ title: t('tab.library'), animation: 'none' }} />
          <Stack.Screen name="new-novel" options={{ title: t('nav.newNovel') }} />
          <Stack.Screen name="settings" options={{ title: t('nav.settings') }} />
          <Stack.Screen name="novel/[novelId]/index" options={{ title: '' }} />
          <Stack.Screen name="novel/[novelId]/settings" options={{ title: 'Novel settings' }} />
          <Stack.Screen
            name="novel/[novelId]/chapter/[seasonId]/[chapterId]"
            options={{ title: 'Chapter' }}
          />
          <Stack.Screen
            name="preview"
            options={{
              title: t('nav.preview'),
              animation: reduced ? 'none' : 'fade',
              contentStyle: { backgroundColor: THEATER_BG },
            }}
          />
          <Stack.Screen name="appearance" options={{ title: t('nav.appearance') }} />
          <Stack.Screen name="growth" options={{ title: 'Growth' }} />
          <Stack.Screen name="folders/index" options={{ title: '', animation: 'none' }} />
          <Stack.Screen name="folders/[folderId]" options={{ title: '' }} />
          <Stack.Screen name="folders/note/[docId]" options={{ title: 'Note' }} />
          <Stack.Screen name="search" options={{ title: '', animation: 'none' }} />
          <Stack.Screen name="novel/[novelId]/compile" options={{ title: 'Book compiler' }} />
          <Stack.Screen name="compile-folder" options={{ title: 'Book compiler' }} />
          <Stack.Screen name="doctor" options={{ title: 'Document Doctor' }} />
          <Stack.Screen name="trash" options={{ title: t('nav.trash') }} />
          <Stack.Screen name="help" options={{ title: t('nav.help') }} />
          <Stack.Screen name="lock" options={{ title: 'Master Lock' }} />
          <Stack.Screen name="open" options={{ title: '' }} />
        </Stack>
        <FolioTabBar />
      </View>
    </View>
  );
}
