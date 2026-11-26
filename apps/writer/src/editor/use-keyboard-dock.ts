// Keeps an editor's bottom dock (FormattingToolbar) riding just above the keyboard, frame-synced
// on the UI thread: react-native-keyboard-controller's useReanimatedKeyboardAnimation drives a
// Reanimated spacer under the dock every IME frame (120 Hz panels included), with no JS-thread
// Keyboard events or re-renders while the keyboard moves. Attach `onRootLayout` to the screen's
// root flex container: its keyboard-closed height tells an `adjustResize` window (the OS already
// shrank us) from an edge-to-edge overlay, so the dock never floats a second keyboard-height gap.
import { createElement, useCallback, useState, type ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export { computeKeyboardOffset } from './keyboard-offset.ts';

export interface KeyboardDock {
  /** Live keyboard state (flips at half-way), for chrome such as the ribbon auto-collapse. */
  keyboardOpen: boolean;
  onRootLayout(e: LayoutChangeEvent): void;
  /** Render directly under the dock: grows with the keyboard on the UI thread. */
  Spacer(): ReactNode;
}

export function useKeyboardDock(): KeyboardDock {
  const { height, progress } = useReanimatedKeyboardAnimation();
  const fullHeight = useSharedValue(0);
  const currentHeight = useSharedValue(0);
  const [keyboardOpen, setOpen] = useState(false);

  const onRootLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      currentHeight.value = h;
      // Only a keyboard-closed layout defines the full height (rotation, split screen, insets).
      if (progress.value < 0.01 || h > fullHeight.value) fullHeight.value = h;
    },
    [currentHeight, fullHeight, progress],
  );

  useAnimatedReaction(
    () => progress.value > 0.5,
    (open, prev) => {
      if (open !== prev) scheduleOnRN(setOpen, open);
    },
  );

  const spacer = useAnimatedStyle(() => {
    // `height` runs 0 → -keyboardHeight. Subtract whatever the OS already absorbed by resizing.
    const shrunkBy = Math.max(0, fullHeight.value - currentHeight.value);
    return { height: Math.max(0, -height.value - shrunkBy) };
  });
  const Spacer = useCallback(
    (): ReactNode => createElement(Animated.View, { style: spacer, pointerEvents: 'none' }),
    [spacer],
  );

  return { keyboardOpen, onRootLayout, Spacer };
}
