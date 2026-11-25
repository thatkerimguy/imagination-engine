import type { NativeStackHeaderProps } from 'expo-router/native-stack';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FolioNavRail } from '../components/FolioNavRail.tsx';
import { FolioTabBar } from '../components/FolioTabBar.tsx';
import { LockGate } from '../security/LockGate.tsx';
import { RepositoryProvider } from '../store/context.tsx';
import { ConfirmProvider } from '../ui/ConfirmDialog.tsx';
import { ThemeProvider, useTheme } from '../ui/theme.tsx';
import { StackTopBar } from '../ui/TopBar.tsx';
import { usesRail } from '../ui/layout-class.ts';
import { useLayoutClass } from '../ui/use-layout-class.ts';
import { useNavigationBarStyle } from '../ui/system-bars.ts';
import { installWebFocusReset } from '../ui/web-focus.ts';

installWebFocusReset();

// Hoisted so React Navigation sees a stable header renderer and never remounts the chrome.
const renderHeader = (props: NativeStackHeaderProps): ReactNode => <StackTopBar {...props} />;

export default function RootLayout(): ReactNode {
  return (
    <SafeAreaProvider>
      <RepositoryProvider>
        <ThemeProvider>
          <ConfirmProvider>
            <LockGate>
              <ThemedStack />
            </LockGate>
          </ConfirmProvider>
        </ThemeProvider>
      </RepositoryProvider>
    </SafeAreaProvider>
  );
}

function ThemedStack(): ReactNode {
  const { dark, colors } = useTheme();
  useNavigationBarStyle(!dark);
  const rail = usesRail(useLayoutClass());
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
          <Stack.Screen name="trash" options={{ title: 'Trash' }} />
          <Stack.Screen name="lock" options={{ title: 'Master Lock' }} />
          <Stack.Screen name="open" options={{ title: '' }} />
        </Stack>
        <FolioTabBar />
      </View>
    </View>
  );
}
