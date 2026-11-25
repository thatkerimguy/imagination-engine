// Routes Android back (and the Android 16 predictive-back gesture) to a screen's inline layers
// before the navigator pops the route. Registered only while the screen is focused, so a screen
// left mounted under Preview never steals Preview's back press.
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { unlockSession } from '../store/unlock-session.ts';
import { handleBackPress, type BackLayer } from './back-layers.ts';

/** `layers` are listed topmost first; see topOpenLayer. */
export function useBackIntercept(layers: readonly BackLayer[]): void {
  const latest = useRef(layers);
  latest.current = layers;
  useFocusEffect(
    useCallback(() => {
      // Back is an Android concept; react-native-web warns on any BackHandler use.
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () =>
        handleBackPress(latest.current, !unlockSession.isMasterUnlocked()),
      );
      return () => sub.remove();
    }, []),
  );
}
