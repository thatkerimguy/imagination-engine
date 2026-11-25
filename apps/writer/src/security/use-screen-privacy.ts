// Holds FLAG_SECURE while `active`. Each hook instance owns a unique tag, so a child screen
// unmounting can never drop protection that LockGate (or another PIN pad) still holds.
import { useEffect, useId } from 'react';
import { allowCapture, preventCapture } from './capture';

export function useScreenPrivacy(tag: string, active = true): void {
  const key = `${tag}:${useId()}`;
  useEffect(() => {
    if (!active) return;
    preventCapture(key);
    return () => allowCapture(key);
  }, [key, active]);
}
