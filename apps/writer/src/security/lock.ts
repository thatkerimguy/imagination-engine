// Master Lock state machine: a 4–6 digit PIN (salted SHA-256), a one-time recovery code (stored
// only hashed), optional biometric unlock and persisted attempt throttling. Pure against a tiny
// store (`DocumentStore`-shaped), so it runs under node. This is a privacy lock for casual access,
// not encryption: the novel data itself is not encrypted at rest.
import type { Stored } from '../store/documents.ts';
import { hashPin, randomBytes, randomSalt } from './hash.ts';

export interface LockStore {
  read<T>(key: string): Promise<Stored<T> | null>;
  write<T>(key: string, data: T): Promise<number>;
}

export interface LockConfig {
  enabled: boolean;
  pinHash: string;
  salt: string;
  recoveryHash: string;
  recoverySalt: string;
  biometric: boolean;
  pinLength: number;
  /** Consecutive wrong attempts. */
  fails?: number;
  /** Epoch ms until which attempts are refused. */
  lockedUntil?: number;
  /** "Hide in app switcher" (FLAG_SECURE); unset means on while Master Lock is on. */
  hideInRecents?: boolean;
}

export const LOCK_KEY = 'setting/lock';
export const MAX_ATTEMPTS = 5;
export const THROTTLE_MS = 30_000;
/** 32 symbols: A–Z without I/O, digits 2–9 (no 0/1) — nothing ambiguous to misread. */
export const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const RECOVERY_LENGTH = 12;

export type VerifyResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'wrong' | 'throttled' | 'no-pin';
      retryAfterMs: number;
      remaining: number;
    };

export const isValidPin = (pin: string): boolean => /^\d{4,6}$/.test(pin);

export const normalizeRecovery = (code: string): string =>
  code.toUpperCase().replace(/[^A-Z0-9]/g, '');

export async function loadLockConfig(store: LockStore): Promise<LockConfig | null> {
  const c = (await store.read<Partial<LockConfig>>(LOCK_KEY))?.data;
  if (!c || typeof c.pinHash !== 'string' || typeof c.salt !== 'string') return null;
  return {
    enabled: c.enabled === true,
    pinHash: c.pinHash,
    salt: c.salt,
    recoveryHash: typeof c.recoveryHash === 'string' ? c.recoveryHash : '',
    recoverySalt: typeof c.recoverySalt === 'string' ? c.recoverySalt : '',
    biometric: c.biometric === true,
    pinLength: typeof c.pinLength === 'number' ? c.pinLength : 4,
    fails: typeof c.fails === 'number' ? c.fails : 0,
    lockedUntil: typeof c.lockedUntil === 'number' ? c.lockedUntil : 0,
    ...(typeof c.hideInRecents === 'boolean' ? { hideInRecents: c.hideInRecents } : {}),
  };
}

const save = (store: LockStore, c: LockConfig): Promise<number> => store.write(LOCK_KEY, c);

async function newRecoveryCode(): Promise<string> {
  const bytes = await randomBytes(RECOVERY_LENGTH);
  return Array.from(bytes, (b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join('');
}

/** Salted hash pair for a freshly generated recovery code (shown once, never stored in clear). */
async function sealRecovery(): Promise<{ code: string; hash: string; salt: string }> {
  const code = await newRecoveryCode();
  const salt = await randomSalt();
  return { code, salt, hash: await hashPin(code, salt) };
}

const refusal = (c: LockConfig, now: number): VerifyResult | null =>
  (c.lockedUntil ?? 0) > now
    ? { ok: false, reason: 'throttled', retryAfterMs: (c.lockedUntil ?? 0) - now, remaining: 0 }
    : null;

/** Records a wrong attempt; after MAX_ATTEMPTS the next attempts wait THROTTLE_MS. */
async function recordFail(store: LockStore, c: LockConfig, now: number): Promise<VerifyResult> {
  const fails = (c.fails ?? 0) + 1;
  const trip = fails >= MAX_ATTEMPTS;
  await save(store, { ...c, fails: trip ? 0 : fails, lockedUntil: trip ? now + THROTTLE_MS : 0 });
  return {
    ok: false,
    reason: trip ? 'throttled' : 'wrong',
    retryAfterMs: trip ? THROTTLE_MS : 0,
    remaining: trip ? 0 : MAX_ATTEMPTS - fails,
  };
}

async function check(
  store: LockStore,
  secret: string,
  pick: (c: LockConfig) => { hash: string; salt: string },
  now: number,
): Promise<{ result: VerifyResult; config: LockConfig | null }> {
  const c = await loadLockConfig(store);
  if (!c)
    return { config: null, result: { ok: false, reason: 'no-pin', retryAfterMs: 0, remaining: 0 } };
  const blocked = refusal(c, now);
  if (blocked) return { config: c, result: blocked };
  const { hash, salt } = pick(c);
  if (hash && (await hashPin(secret, salt)) === hash) return { config: c, result: { ok: true } };
  return { config: c, result: await recordFail(store, c, now) };
}

/** Sets the first PIN, turns Master Lock on and returns the one-time recovery code. */
export async function setupPin(store: LockStore, pin: string): Promise<string> {
  if (!isValidPin(pin)) throw new Error('PIN must be 4–6 digits');
  const salt = await randomSalt();
  const rec = await sealRecovery();
  await save(store, {
    enabled: true,
    pinHash: await hashPin(pin, salt),
    salt,
    recoveryHash: rec.hash,
    recoverySalt: rec.salt,
    biometric: false,
    pinLength: pin.length,
  });
  return rec.code;
}

export async function verifyPin(
  store: LockStore,
  pin: string,
  now = Date.now(),
): Promise<VerifyResult> {
  const { result, config } = await check(
    store,
    pin,
    (c) => ({ hash: c.pinHash, salt: c.salt }),
    now,
  );
  if (result.ok && config && (config.fails ?? 0) > 0) {
    await save(store, { ...config, fails: 0, lockedUntil: 0 });
  }
  return result;
}

/** Valid recovery code + new PIN: resets the PIN, re-enables the lock and issues a new code. */
export async function verifyRecovery(
  store: LockStore,
  code: string,
  newPin: string,
  now = Date.now(),
): Promise<VerifyResult & { recoveryCode?: string }> {
  if (!isValidPin(newPin)) throw new Error('PIN must be 4–6 digits');
  const { result, config } = await check(
    store,
    normalizeRecovery(code),
    (c) => ({ hash: c.recoveryHash, salt: c.recoverySalt }),
    now,
  );
  if (!result.ok || !config) return result;
  const salt = await randomSalt();
  const rec = await sealRecovery();
  await save(store, {
    ...config,
    enabled: true,
    pinHash: await hashPin(newPin, salt),
    salt,
    recoveryHash: rec.hash,
    recoverySalt: rec.salt,
    pinLength: newPin.length,
    fails: 0,
    lockedUntil: 0,
  });
  return { ok: true, recoveryCode: rec.code };
}

/** Changes the PIN after verifying the old one. */
export async function changePin(
  store: LockStore,
  oldPin: string,
  newPin: string,
  now = Date.now(),
): Promise<VerifyResult> {
  if (!isValidPin(newPin)) throw new Error('PIN must be 4–6 digits');
  const r = await verifyPin(store, oldPin, now);
  const c = await loadLockConfig(store);
  if (!r.ok || !c) return r;
  const salt = await randomSalt();
  await save(store, { ...c, pinHash: await hashPin(newPin, salt), salt, pinLength: newPin.length });
  return r;
}

async function patch(store: LockStore, change: Partial<LockConfig>): Promise<void> {
  const c = await loadLockConfig(store);
  if (c) await save(store, { ...c, ...change });
}

/** Turns Master Lock off (the PIN stays so individually locked items keep working). */
export const disableLock = (store: LockStore): Promise<void> => patch(store, { enabled: false });
export const enableLock = (store: LockStore): Promise<void> => patch(store, { enabled: true });
export const setBiometric = (store: LockStore, on: boolean): Promise<void> =>
  patch(store, { biometric: on });
export const setHideInRecents = (store: LockStore, on: boolean): Promise<void> =>
  patch(store, { hideInRecents: on });
