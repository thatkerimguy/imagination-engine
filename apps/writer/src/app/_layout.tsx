import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RepositoryProvider } from '../store/context.tsx';
import { colors } from '../ui/theme.ts';

export default function RootLayout(): ReactNode {
  return (
    <SafeAreaProvider>
      <RepositoryProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.fg,
            headerTitleStyle: { fontWeight: '700' },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Bookshelf' }} />
          <Stack.Screen name="new-novel" options={{ title: 'New novel', presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ title: 'Writer settings' }} />
          <Stack.Screen name="novel/[novelId]/index" options={{ title: 'Outline' }} />
          <Stack.Screen name="novel/[novelId]/settings" options={{ title: 'Novel settings' }} />
          <Stack.Screen
            name="novel/[novelId]/chapter/[seasonId]/[chapterId]"
            options={{ title: 'Chapter' }}
          />
          <Stack.Screen name="preview" options={{ title: 'Live preview' }} />
        </Stack>
      </RepositoryProvider>
    </SafeAreaProvider>
  );
}
