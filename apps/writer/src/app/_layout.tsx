import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RepositoryProvider } from '../store/context.tsx';
import { ConfirmProvider } from '../ui/ConfirmDialog.tsx';
import { HeaderScrollProvider } from '../ui/header-scroll.tsx';
import { ThemeProvider, useTheme } from '../ui/theme.tsx';
import { StackTopBar } from '../ui/TopBar.tsx';
import { installWebFocusReset } from '../ui/web-focus.ts';

installWebFocusReset();

export default function RootLayout(): ReactNode {
  return (
    <SafeAreaProvider>
      <RepositoryProvider>
        <ThemeProvider>
          <ConfirmProvider>
            <HeaderScrollProvider>
              <ThemedStack />
            </HeaderScrollProvider>
          </ConfirmProvider>
        </ThemeProvider>
      </RepositoryProvider>
    </SafeAreaProvider>
  );
}

function ThemedStack(): ReactNode {
  const { dark, colors } = useTheme();
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          header: (props) => <StackTopBar {...props} />,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Library' }} />
        <Stack.Screen name="new-novel" options={{ title: 'New novel' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="novel/[novelId]/index" options={{ title: '' }} />
        <Stack.Screen name="novel/[novelId]/settings" options={{ title: 'Novel settings' }} />
        <Stack.Screen
          name="novel/[novelId]/chapter/[seasonId]/[chapterId]"
          options={{ title: 'Chapter' }}
        />
        <Stack.Screen name="preview" options={{ title: 'Preview' }} />
        <Stack.Screen name="appearance" options={{ title: 'Appearance & fonts' }} />
        <Stack.Screen name="growth" options={{ title: 'Growth' }} />
      </Stack>
    </>
  );
}
