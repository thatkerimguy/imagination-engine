import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '../storage/memory.ts';
import { NovelRepository } from '../store/repository.ts';
import {
  DEFAULT_WRITER_PREFS,
  loadWriterPrefs,
  normalizeWriterPrefs,
  saveWriterPrefs,
} from '../store/writer-prefs.ts';

const repo = (): NovelRepository => new NovelRepository(createMemoryAdapter());

describe('toolbar collapse prefs', () => {
  it('defaults to both halves expanded', async () => {
    const p = await loadWriterPrefs(repo());
    expect(p.toolbarFormatCollapsed).toBe(false);
    expect(p.toolbarAddCollapsed).toBe(false);
    expect(DEFAULT_WRITER_PREFS.toolbarFormatCollapsed).toBe(false);
  });

  it('persists each half independently across reloads', async () => {
    const r = repo();
    await saveWriterPrefs(r, { toolbarFormatCollapsed: true });
    let p = await loadWriterPrefs(r);
    expect([p.toolbarFormatCollapsed, p.toolbarAddCollapsed]).toEqual([true, false]);
    await saveWriterPrefs(r, { toolbarAddCollapsed: true });
    p = await loadWriterPrefs(r);
    expect([p.toolbarFormatCollapsed, p.toolbarAddCollapsed]).toEqual([true, true]);
    await saveWriterPrefs(r, { toolbarFormatCollapsed: false });
    p = await loadWriterPrefs(r);
    expect([p.toolbarFormatCollapsed, p.toolbarAddCollapsed]).toEqual([false, true]);
  });

  it('normalizes junk values to false', () => {
    const p = normalizeWriterPrefs({
      toolbarFormatCollapsed: 'yes',
      toolbarAddCollapsed: 1,
    } as unknown as Partial<typeof DEFAULT_WRITER_PREFS>);
    expect(p.toolbarFormatCollapsed).toBe(false);
    expect(p.toolbarAddCollapsed).toBe(false);
  });
});
