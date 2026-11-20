import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FolioTabBar } from '../components/FolioTabBar.tsx';
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
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
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
        <Stack.Screen name="folders/index" options={{ title: '', animation: 'none' }} />
        <Stack.Screen name="folders/[folderId]" options={{ title: '' }} />
        <Stack.Screen name="folders/note/[docId]" options={{ title: 'Note' }} />
        <Stack.Screen name="search" options={{ title: '', animation: 'none' }} />
        <Stack.Screen name="novel/[novelId]/compile" options={{ title: 'Book compiler' }} />
        <Stack.Screen name="compile-folder" options={{ title: 'Book compiler' }} />
        <Stack.Screen name="doctor" options={{ title: 'Document Doctor' }} />
        <Stack.Screen name="lock" options={{ title: 'Master Lock' }} />
      </Stack>
      <FolioTabBar />
    </View>
  );
}
