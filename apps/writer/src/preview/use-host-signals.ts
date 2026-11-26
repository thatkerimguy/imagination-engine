// Host-side signals the embedded reader cannot see on its own: whether the Preview screen is
// focused with the app in the foreground, and the OS "Remove animations" / Reduce Motion state.
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** True only while this screen is focused AND the app is `active` (not background/inactive). */
export function useForeground(): boolean {
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(AppState.currentState === 'active');

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);

  return focused && active;
}

export { useReduceMotion } from '../ui/use-reduce-motion.ts';
