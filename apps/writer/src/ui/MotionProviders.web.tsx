// Web (react-native-web / Playwright): the pager uses PanResponder and the browser owns the soft
// keyboard, so only gesture-handler's root view is needed — no keyboard-controller on web.
import type { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export function MotionProviders({ children }: { children: ReactNode }): ReactNode {
  return <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>;
}
