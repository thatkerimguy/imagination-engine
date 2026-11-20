// Shared "is the page scrolled?" flag so the stack TopBar shows its hairline only once content
// has moved under it. Pages report via useScrollReporter(); the bar reads useHeaderScrolled().
import { useFocusEffect } from 'expo-router';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

interface ScrollState {
  scrolled: boolean;
  setScrolled(next: boolean): void;
}

const Ctx = createContext<ScrollState>({ scrolled: false, setScrolled: () => undefined });

export function HeaderScrollProvider({ children }: { children: ReactNode }): ReactNode {
  const [scrolled, setScrolled] = useState(false);
  const value = useMemo(() => ({ scrolled, setScrolled }), [scrolled]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useHeaderScrolled = (): boolean => useContext(Ctx).scrolled;

/** onScroll handler for a page's ScrollView; resets the flag whenever the page gains focus. */
export function useScrollReporter(): (e: NativeSyntheticEvent<NativeScrollEvent>) => void {
  const { scrolled, setScrolled } = useContext(Ctx);
  useFocusEffect(
    useCallback(() => {
      setScrolled(false);
    }, [setScrolled]),
  );
  return useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = e.nativeEvent.contentOffset.y > 2;
      if (next !== scrolled) setScrolled(next);
    },
    [scrolled, setScrolled],
  );
}
