import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '../storage/memory.ts';
import { NovelRepository } from '../store/repository.ts';
import {
  acceptCurrentTos,
  CURRENT_TOS_VERSION,
  hasAcceptedCurrentTos,
  loadTosConsent,
  PUBLISH_TOS_KEY,
  termsUrl,
} from './publish-settings.ts';

const repo = (): NovelRepository => new NovelRepository(createMemoryAdapter(), () => 5);

describe('Publishing Terms of Use consent', () => {
  it('pins the current Terms version', () => {
    expect(CURRENT_TOS_VERSION).toBe('2026-11');
  });

  it('gates until the current version is accepted', () => {
    expect(hasAcceptedCurrentTos(undefined)).toBe(false);
    expect(hasAcceptedCurrentTos({})).toBe(false);
    expect(hasAcceptedCurrentTos({ tosAcceptedVersion: '2025-01' })).toBe(false);
    expect(hasAcceptedCurrentTos({ tosAcceptedVersion: CURRENT_TOS_VERSION })).toBe(true);
  });

  it('starts unaccepted and persists acceptance with a timestamp', async () => {
    const r = repo();
    expect(hasAcceptedCurrentTos(await loadTosConsent(r))).toBe(false);
    const now = new Date('2026-11-25T10:00:00.000Z');
    await acceptCurrentTos(r, now);
    const stored = await loadTosConsent(r);
    expect(stored).toEqual({
      tosAcceptedVersion: CURRENT_TOS_VERSION,
      tosAcceptedAt: '2026-11-25T10:00:00.000Z',
    });
    expect(hasAcceptedCurrentTos(stored)).toBe(true);
  });

  it('re-gates when the stored version is stale or malformed', async () => {
    const r = repo();
    await r.docs.write(PUBLISH_TOS_KEY, { tosAcceptedVersion: '2024-01', tosAcceptedAt: 'x' });
    expect(hasAcceptedCurrentTos(await loadTosConsent(r))).toBe(false);
    await r.docs.write(PUBLISH_TOS_KEY, 'garbage');
    expect(await loadTosConsent(r)).toEqual({});
  });

  it('links the full Terms on the configured publish API', () => {
    expect(termsUrl({ apiUrl: 'https://api.example.test', readerUrl: '' })).toBe(
      'https://api.example.test/legal/terms',
    );
    expect(termsUrl({ apiUrl: '', readerUrl: '' })).toBe('');
  });
});
