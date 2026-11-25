// Native shake for the Live Preview: Android WebViews often hide DeviceMotionEvent data from the
// offline reader, so the writer listens to the real accelerometer (expo-sensors) and forwards a
// shake into the page. Loaded lazily, only on native, only while the Preview screen is focused
// and the app is in the foreground; the subscription is dropped immediately otherwise.
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useForeground } from './use-host-signals.ts';

const SAMPLE_MS = 33;
const GRAVITY_ALPHA = 0.8;
/** Linear acceleration (in g, gravity removed) that counts as a shake. */
const SHAKE_DELTA_G = 1.15;
const COOLDOWN_MS = 900;

export function useNativeShake(enabled: boolean, onShake: () => void): void {
  const handler = useRef(onShake);
  handler.current = onShake;
  const foreground = useForeground();
  const listen = enabled && foreground && Platform.OS !== 'web';
  useEffect(() => {
    if (!listen) return;
    let live = true;
    let remove: (() => void) | null = null;
    void import('expo-sensors')
      .then(async ({ Accelerometer }) => {
        if (!live || !(await Accelerometer.isAvailableAsync())) return;
        if (!live) return;
        let gravity: [number, number, number] | null = null;
        let last = 0;
        Accelerometer.setUpdateInterval(SAMPLE_MS);
        const sub = Accelerometer.addListener(({ x, y, z }) => {
          if (!gravity) {
            gravity = [x, y, z];
            return;
          }
          const k = GRAVITY_ALPHA;
          gravity = [
            k * gravity[0] + (1 - k) * x,
            k * gravity[1] + (1 - k) * y,
            k * gravity[2] + (1 - k) * z,
          ];
          const linear = Math.hypot(x - gravity[0], y - gravity[1], z - gravity[2]);
          const now = Date.now();
          if (linear > SHAKE_DELTA_G && now - last > COOLDOWN_MS) {
            last = now;
            handler.current();
          }
        });
        remove = () => sub.remove();
      })
      .catch(() => undefined);
    return () => {
      live = false;
      remove?.();
    };
  }, [listen]);
}
