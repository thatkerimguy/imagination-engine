import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '../storage/memory.ts';
import { DocumentStore } from '../store/documents.ts';
import { sha256Hex, sha256Pure } from './hash.ts';
import {
  LOCK_KEY,
  MAX_ATTEMPTS,
  RECOVERY_ALPHABET,
  THROTTLE_MS,
  changePin,
  disableLock,
  loadLockConfig,
  setupPin,
  verifyPin,
  verifyRecovery,
} from './lock.ts';

const make = () => {
  const adapter = createMemoryAdapter();
  return { adapter, store: new DocumentStore(adapter) };
};

describe('sha256', () => {
  it('matches known vectors', () => {
    expect(sha256Pure('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Pure('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(sha256Pure('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });
  it('sha256Hex agrees with the pure implementation', async () => {
    expect(await sha256Hex('héllo')).toBe(sha256Pure('héllo'));
  });
});

describe('lock', () => {
  it('setup then verify: right PIN ok, wrong PIN fails', async () => {
    const { store } = make();
    await setupPin(store, '1234');
    expect((await verifyPin(store, '1234')).ok).toBe(true);
    const bad = await verifyPin(store, '4321');
    expect(bad.ok).toBe(false);
    expect((await loadLockConfig(store))?.enabled).toBe(true);
  });
  it('rejects malformed PINs', async () => {
    await expect(setupPin(make().store, '12')).rejects.toThrow();
  });
  it('recovery code is 12 allowed chars and stored only hashed', async () => {
    const { store, adapter } = make();
    const code = await setupPin(store, '123456');
    expect(code).toHaveLength(12);
    for (const ch of code) expect(RECOVERY_ALPHABET).toContain(ch);
    const raw = (await adapter.get(LOCK_KEY)) ?? '';
    expect(raw).not.toContain(code);
    expect(raw).not.toContain('123456');
  });
  it('recovery resets the PIN and issues a new code', async () => {
    const { store } = make();
    const code = await setupPin(store, '1234');
    const bad = await verifyRecovery(store, 'AAAAAAAAAAAA', '9999');
    expect(bad.ok).toBe(false);
    const ok = await verifyRecovery(store, code.toLowerCase().replace(/(.{4})/g, '$1-'), '9999');
    expect(ok.ok).toBe(true);
    expect((await verifyPin(store, '9999')).ok).toBe(true);
    expect((await verifyPin(store, '1234')).ok).toBe(false);
    expect(ok.recoveryCode).toBeDefined();
    expect(ok.recoveryCode).not.toBe(code);
  });
  it('changePin needs the old PIN; disableLock keeps the PIN', async () => {
    const { store } = make();
    await setupPin(store, '1234');
    expect((await changePin(store, '0000', '5555')).ok).toBe(false);
    expect((await changePin(store, '1234', '5555')).ok).toBe(true);
    expect((await verifyPin(store, '5555')).ok).toBe(true);
    await disableLock(store);
    const c = await loadLockConfig(store);
    expect(c?.enabled).toBe(false);
    expect((await verifyPin(store, '5555')).ok).toBe(true);
  });
  it('throttles after repeated wrong attempts, even for the right PIN', async () => {
    const { store } = make();
    await setupPin(store, '1234');
    const t0 = 1_000_000;
    let last = await verifyPin(store, '0000', t0);
    for (let i = 1; i < MAX_ATTEMPTS; i++) last = await verifyPin(store, '0000', t0);
    expect(last.ok === false && last.reason).toBe('throttled');
    const during = await verifyPin(store, '1234', t0 + 1000);
    expect(during.ok === false && during.reason).toBe('throttled');
    expect((await verifyPin(store, '1234', t0 + THROTTLE_MS + 1)).ok).toBe(true);
  });
});
