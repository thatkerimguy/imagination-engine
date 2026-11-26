// OS "Remove animations" (Android) / Reduce Motion (iOS), shared by the root Stack transitions,
// the root tab pager and the Preview host. Re-exported from preview/use-host-signals.ts.
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Android "Remove animations" / iOS Reduce Motion, kept current while mounted. */
export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => live && setReduced(on))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
