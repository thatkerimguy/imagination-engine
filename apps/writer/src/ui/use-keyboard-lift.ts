// JS-thread keyboard lift for bottom sheets (Sheet.tsx): extra bottom margin so a sheet rides
// on the keyboard. Attach `onRootLayout` to the root flex container; its keyboard-closed height
// tells an `adjustResize` window from an edge-to-edge overlay (see computeKeyboardOffset).
// Editors use the UI-thread, frame-synced dock in editor/use-keyboard-dock.ts instead.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent, type LayoutChangeEvent } from 'react-native';
import { computeKeyboardOffset } from '../editor/keyboard-offset.ts';

export interface KeyboardLift {
  /** Extra bottom margin for the dock, in dp (0 when closed, on web, or when the OS resized). */
  keyboardOffset: number;
  keyboardOpen: boolean;
  onRootLayout(e: LayoutChangeEvent): void;
}

export function useKeyboardLift(): KeyboardLift {
  const [keyboardOffset, setOffset] = useState(0);
  const [keyboardOpen, setOpen] = useState(false);
  const fullHeight = useRef(0);
  const currentHeight = useRef(0);
  const open = useRef(false);

  const onRootLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    currentHeight.current = h;
    // Only a keyboard-closed layout defines the full height (rotation, split screen, insets).
    if (!open.current || h > fullHeight.current) fullHeight.current = h;
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const ios = Platform.OS === 'ios';
    let raf = 0;
    const show = (e: KeyboardEvent): void => {
      open.current = true;
      setOpen(true);
      const kb = e.endCoordinates.height;
      const apply = (): void =>
        setOffset(
          computeKeyboardOffset(Platform.OS, kb, fullHeight.current, currentHeight.current),
        );
      // Android: wait one frame so onRootLayout has seen any adjustResize shrink first.
      if (ios) apply();
      else raf = requestAnimationFrame(apply);
    };
    const hide = (): void => {
      cancelAnimationFrame(raf);
      open.current = false;
      setOpen(false);
      setOffset(0);
    };
    const subs = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', show),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', hide),
    ];
    return () => {
      cancelAnimationFrame(raf);
      subs.forEach((s) => s.remove());
    };
  }, []);

  return { keyboardOffset, keyboardOpen, onRootLayout };
}
