// A PinPad wired to verifyPin: wrong-PIN captions, a live throttle countdown and optional
// biometric unlock. Shared by the app gate, the per-item gate and the Master Lock screen.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRepository } from '../store/context.tsx';
import { authenticateBiometric, biometricAvailable } from './biometric.ts';
import { verifyPin, type LockConfig, type VerifyResult } from './lock.ts';
import { PinPad } from './PinPad.tsx';

export interface LockPromptProps {
  config: LockConfig;
  title: string;
  caption?: string;
  /** Biometrics may unlock this prompt (false when changing the PIN or turning the lock off). */
  allowBiometric?: boolean;
  /** Prompt for biometrics immediately on mount. */
  autoBiometric?: boolean;
  /** `pin` is the verified PIN, or '' when biometrics unlocked it. */
  onUnlocked(pin: string): void;
}

export function failureMessage(r: Extract<VerifyResult, { ok: false }>): string {
  if (r.reason === 'throttled') {
    return `Too many attempts. Try again in ${Math.max(1, Math.ceil(r.retryAfterMs / 1000))} s.`;
  }
  return r.remaining <= 2 ? `Wrong PIN. ${r.remaining} tries left.` : 'Wrong PIN.';
}

export function LockPrompt(p: LockPromptProps): ReactNode {
  const repo = useRepository();
  const { onUnlocked, allowBiometric, autoBiometric } = p;
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const [until, setUntil] = useState(0);
  const [, tick] = useState(0);
  const [bio, setBio] = useState(false);

  useEffect(() => {
    if (until <= Date.now()) return;
    const t = setInterval(() => {
      tick((n) => n + 1);
      if (Date.now() >= until) {
        setUntil(0);
        setError(null);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [until]);

  const runBiometric = useCallback(async () => {
    if (await authenticateBiometric('Unlock your writing')) onUnlocked('');
  }, [onUnlocked]);

  const wantBio = allowBiometric !== false && p.config.biometric;
  useEffect(() => {
    if (!wantBio) return;
    let live = true;
    void biometricAvailable().then((ok) => {
      if (!live) return;
      setBio(ok);
      if (ok && autoBiometric) void runBiometric();
    });
    return () => {
      live = false;
    };
  }, [wantBio, autoBiometric, runBiometric]);

  const submit = async (pin: string): Promise<void> => {
    const r = await verifyPin(repo.docs, pin);
    if (r.ok) return onUnlocked(pin);
    if (r.reason === 'throttled') setUntil(Date.now() + r.retryAfterMs);
    setError(failureMessage(r));
    setErrorKey((k) => k + 1);
  };

  const throttled = until > Date.now();
  const caption = throttled
    ? `Too many attempts. Try again in ${Math.max(1, Math.ceil((until - Date.now()) / 1000))} s.`
    : error;
  return (
    <PinPad
      length={p.config.pinLength}
      title={p.title}
      caption={p.caption}
      error={caption}
      errorKey={errorKey}
      disabled={throttled}
      onBiometric={wantBio && bio ? () => void runBiometric() : undefined}
      onComplete={(pin) => void submit(pin)}
    />
  );
}
