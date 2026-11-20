import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RepositoryProvider } from '../store/context.tsx';
import { DialogProvider } from '../ui/Dialog.tsx';
import { ThemeProvider, useTheme } from '../ui/theme.tsx';
import { StackTopBar } from '../ui/TopBar.tsx';

export default function RootLayout(): ReactNode {
  return (
    <SafeAreaProvider>
      <RepositoryProvider>
        <ThemeProvider>
          <DialogProvider>
            <ThemedStack />
          </DialogProvider>
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
          contentStyle: { backgroundColor: colors.surface },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Bookshelf' }} />
        <Stack.Screen name="new-novel" options={{ title: 'New novel' }} />
        <Stack.Screen name="settings" options={{ title: 'Writer settings' }} />
        <Stack.Screen name="novel/[novelId]/index" options={{ title: 'Outline' }} />
        <Stack.Screen name="novel/[novelId]/settings" options={{ title: 'Novel settings' }} />
        <Stack.Screen
          name="novel/[novelId]/chapter/[seasonId]/[chapterId]"
          options={{ title: 'Chapter' }}
        />
        <Stack.Screen name="preview" options={{ title: 'Live preview' }} />
        <Stack.Screen name="appearance" options={{ title: 'Appearance & fonts' }} />
        <Stack.Screen name="growth" options={{ title: 'Growth' }} />
      </Stack>
    </>
  );
}
