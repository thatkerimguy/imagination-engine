import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '../storage/memory.ts';
import { NovelRepository } from '../store/repository.ts';
import { DEFAULT_SETTINGS, loadSettings, previewUrl, saveSettings } from './app-settings.ts';

describe('previewUrl', () => {
  it('adds preview=1 and keeps the path', () => {
    const url = new URL(previewUrl('http://192.168.1.5:5173/reader/ ')!);
    expect(url.pathname).toBe('/reader/');
    expect(url.searchParams.get('preview')).toBe('1');
  });

  it('overrides an existing preview param and strips the hash', () => {
    const out = previewUrl('https://x.test/?preview=0&a=b#frag')!;
    expect(out).not.toContain('#');
    const params = new URL(out).searchParams;
    expect(params.get('preview')).toBe('1');
    expect(params.get('a')).toBe('b');
  });

  it('rejects garbage and non-http(s) URLs', () => {
    expect(previewUrl('not a url')).toBeNull();
    expect(previewUrl('')).toBeNull();
    expect(previewUrl('ftp://example.com')).toBeNull();
    expect(previewUrl('javascript:alert(1)')).toBeNull();
    expect(previewUrl('file:///etc/passwd')).toBeNull();
  });
});

describe('settings storage', () => {
  it('loadSettings returns defaults, then stored values', async () => {
    const repo = new NovelRepository(createMemoryAdapter());
    expect(await loadSettings(repo)).toEqual(DEFAULT_SETTINGS);
    await saveSettings(repo, { readerUrl: 'https://r.test/' });
    expect(await loadSettings(repo)).toEqual({ ...DEFAULT_SETTINGS, readerUrl: 'https://r.test/' });
  });
});

describe('language setting', () => {
  it('defaults to system and persists a valid choice', async () => {
    const repo = new NovelRepository(createMemoryAdapter());
    expect((await loadSettings(repo)).language).toBe('system');
    await saveSettings(repo, { language: 'es' });
    expect((await loadSettings(repo)).language).toBe('es');
  });

  it('rejects an unknown stored language', async () => {
    const repo = new NovelRepository(createMemoryAdapter());
    await saveSettings(repo, { language: 'xx' as never });
    expect((await loadSettings(repo)).language).toBe('system');
  });
});
