// Shared "is the page scrolled?" flag so the stack TopBar shows its hairline only once content
// has moved under it. Pages report via useScrollReporter(); the bar reads useHeaderScrolled().
// State lives in a tiny external store: only the subscribed top bar re-renders, and only when the
// 4px threshold is crossed (never per scroll event).
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const THRESHOLD = 4;

let scrolled = false;
const listeners = new Set<() => void>();

function setScrolled(next: boolean): void {
  if (scrolled === next) return;
  scrolled = next;
  listeners.forEach((l) => l());
}

/** Clears the hairline when a pager swaps the visible page under the same top bar. */
export const resetHeaderScrolled = (): void => setScrolled(false);

const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnapshot = (): boolean => scrolled;

export const useHeaderScrolled = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

type ScrollHandler = (e: NativeSyntheticEvent<NativeScrollEvent>) => void;

/** onScroll handler for a page's ScrollView; resets the flag whenever the page gains focus. */
export function useScrollReporter(): ScrollHandler {
  useFocusEffect(
    useCallback(() => {
      setScrolled(false);
    }, []),
  );
  const handler = useRef<ScrollHandler>((e) => {
    setScrolled(e.nativeEvent.contentOffset.y > THRESHOLD);
  });
  return handler.current;
}
