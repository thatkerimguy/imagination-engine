// Native root providers for the 120 Hz motion foundation: gesture-handler's root view (UI-thread
// gestures such as RootTabsPager) and react-native-keyboard-controller's provider (frame-accurate
// IME insets on the UI thread). Wraps the whole app once; never remounts on rotation or fold.
import type { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

export function MotionProviders({ children }: { children: ReactNode }): ReactNode {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>{children}</KeyboardProvider>
    </GestureHandlerRootView>
  );
}
