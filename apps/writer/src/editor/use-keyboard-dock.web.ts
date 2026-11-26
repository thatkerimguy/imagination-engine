// Web: the browser resizes the visual viewport itself, so the dock needs no lift and no
// keyboard-controller / Reanimated dependency (react-native-web stays error-free).
import type { ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';

export { computeKeyboardOffset } from './keyboard-offset.ts';

export interface KeyboardDock {
  keyboardOpen: boolean;
  onRootLayout(e: LayoutChangeEvent): void;
  Spacer(): ReactNode;
}

const DOCK: KeyboardDock = {
  keyboardOpen: false,
  onRootLayout: () => undefined,
  Spacer: () => null,
};

export const useKeyboardDock = (): KeyboardDock => DOCK;
