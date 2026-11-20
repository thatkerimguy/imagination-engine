import { ulid } from '@kn/core';
import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '../storage/memory.ts';
import { kvFromAdapter, repairAll, repairIssue, scanWorkspace, type Issue } from './doctor.ts';

const prose = (text = 'Hello') => ({ id: ulid(), kind: 'prose', text });
const env = (data: unknown) => JSON.stringify({ data, updatedAt: 1 });

function workspace(extra: Record<string, string> = {}) {
  const adapter = createMemoryAdapter({
    'novel/n1': env({
      schemaVersion: 1,
      id: 'n1',
      title: 'Book',
      author: 'A',
      sectionLabel: 'Season',
      theme: {},
      enabledModules: [],
      seasons: ['s1'],
    }),
    'season/n1/s1': env({ id: 's1', title: 'S', chapters: ['c1'] }),
    'chapter/n1/s1/c1': env({
      id: 'c1',
      seasonId: 's1',
      title: 'One',
      status: 'draft',
      blocks: [prose()],
    }),
    'folder/f1': env({ id: 'f1', parentFolderId: null, title: 'F', createdAt: 1, updatedAt: 1 }),
    'doc/d1': env({
      id: 'd1',
      parentFolderId: 'f1',
      title: 'D',
      createdAt: 1,
      updatedAt: 1,
      blocks: [],
    }),
    'meta/item/c1': env({ tags: [] }),
    ...extra,
  });
  return { adapter, kv: kvFromAdapter(adapter) };
}

const has = (issues: Issue[], id: string, key: string): boolean =>
  issues.some((i) => i.id.startsWith(`${id}:`) && i.key === key);

describe('scanWorkspace', () => {
  it('reports nothing for a healthy workspace', async () => {
    expect(await scanWorkspace(workspace().kv)).toEqual([]);
  });

  it('detects corrupt JSON and invalid manifests', async () => {
    const { kv } = workspace({
      'season/n1/s2': '{not json',
      'chapter/n1/s1/c9': env({ id: 'c9' }),
    });
    const issues = await scanWorkspace(kv);
    expect(has(issues, 'corrupt', 'season/n1/s2')).toBe(true);
    expect(has(issues, 'invalid', 'chapter/n1/s1/c9')).toBe(true);
    expect(issues.every((i) => i.severity === 'error' || i.severity === 'warning')).toBe(true);
  });

  it('detects orphan and missing season / chapter links', async () => {
    const { kv } = workspace({
      'season/n1/s2': env({ id: 's2', title: 'Loose', chapters: [] }),
      'chapter/n1/s1/c2': env({
        id: 'c2',
        seasonId: 's1',
        title: 'Loose',
        status: 'draft',
        blocks: [],
      }),
    });
    await kv.set(
      'novel/n1',
      env({
        schemaVersion: 1,
        id: 'n1',
        title: 'B',
        author: 'A',
        sectionLabel: 'Season',
        theme: {},
        enabledModules: [],
        seasons: ['s1', 'ghost'],
      }),
    );
    await kv.set('season/n1/s1', env({ id: 's1', title: 'S', chapters: ['c1', 'gone'] }));
    const issues = await scanWorkspace(kv);
    expect(has(issues, 'orphan-season', 'season/n1/s2')).toBe(true);
    expect(has(issues, 'orphan-chapter', 'chapter/n1/s1/c2')).toBe(true);
    expect(has(issues, 'missing-season', 'novel/n1')).toBe(true);
    expect(has(issues, 'missing-chapter', 'season/n1/s1')).toBe(true);
  });

  it('detects bad module blocks', async () => {
    const mod = (moduleId: string, props: Record<string, unknown>) => ({
      id: ulid(),
      kind: 'module',
      moduleId,
      moduleVersion: 1,
      props,
    });
    const { kv } = workspace({
      'chapter/n1/s1/c1': env({
        id: 'c1',
        seasonId: 's1',
        title: 'One',
        status: 'draft',
        blocks: [mod('no-such-module', {}), mod('bl-dice-3d', { count: 99 })],
      }),
    });
    const issues = await scanWorkspace(kv);
    expect(has(issues, 'unknown-module', 'chapter/n1/s1/c1')).toBe(true);
    expect(has(issues, 'bad-props', 'chapter/n1/s1/c1')).toBe(true);
  });

  it('detects missing parent folders, orphan sidecars and broken URIs', async () => {
    const { kv } = workspace({
      'doc/d2': env({ id: 'd2', parentFolderId: 'nope', title: 'X', blocks: [] }),
      'meta/item/ghost': env({ tags: [] }),
      'meta/chapter-styles/ghost': env({}),
      'versions/doc:ghost': env({ snapshots: [] }),
      'meta/item/d1': env({ tags: [], coverUri: 'nonsense' }),
      'meta/item/f1': env({ tags: [], coverUri: 'file:///gone.png' }),
      'prefs/custom-fonts': env([
        { id: 'custom-font-1', displayName: 'Bad', uri: 'file:///gone.ttf', format: 'ttf' },
      ]),
    });
    const issues = await scanWorkspace(kv, { fileExists: async () => false });
    expect(has(issues, 'orphan-parent', 'doc/d2')).toBe(true);
    expect(has(issues, 'orphan-sidecar', 'meta/item/ghost')).toBe(true);
    expect(has(issues, 'orphan-sidecar', 'meta/chapter-styles/ghost')).toBe(true);
    expect(has(issues, 'orphan-sidecar', 'versions/doc:ghost')).toBe(true);
    expect(has(issues, 'bad-cover', 'meta/item/d1')).toBe(true);
    expect(has(issues, 'bad-cover', 'meta/item/f1')).toBe(true);
    expect(has(issues, 'bad-font', 'prefs/custom-fonts')).toBe(true);
  });
});

describe('repair', () => {
  it('quarantines the raw payload before modifying it', async () => {
    const { adapter, kv } = workspace({
      'doc/d2': env({ id: 'd2', parentFolderId: 'nope', blocks: [] }),
    });
    const original = (await adapter.get('doc/d2')) as string;
    const issue = (await scanWorkspace(kv)).find((i) => i.key === 'doc/d2') as Issue;
    await repairIssue(kv, issue);
    const q = JSON.parse((await adapter.get('quarantine/doc/d2')) as string) as {
      data: { raw: string; key: string };
    };
    expect(q.data.raw).toBe(original);
    expect(q.data.key).toBe('doc/d2');
    expect((await adapter.get('doc/d2')) as string).toContain('"parentFolderId":null');
  });

  it('quarantines corrupt values instead of deleting them', async () => {
    const { adapter, kv } = workspace({ 'season/n1/s2': '{broken' });
    await repairAll(kv);
    expect(await adapter.get('season/n1/s2')).toBeNull();
    expect(await adapter.get('quarantine/season/n1/s2')).toContain('{broken');
  });

  it('repairAll leaves a clean rescan with no errors', async () => {
    const { adapter, kv } = workspace({
      'season/n1/s2': '{broken',
      'chapter/n1/s1/c9': env({ id: 'c9' }),
      'chapter/n1/s1/c2': env({
        id: 'c2',
        seasonId: 's1',
        title: 'Loose',
        status: 'draft',
        blocks: [],
      }),
      'doc/d2': env({ id: 'd2', parentFolderId: 'nope', blocks: [] }),
      'meta/item/ghost': env({ tags: [] }),
      'meta/item/d1': env({ tags: [], coverUri: 'nonsense' }),
    });
    await kv.set('season/n1/s1', env({ id: 's1', title: 'S', chapters: ['c1', 'gone'] }));
    expect((await scanWorkspace(kv)).length).toBeGreaterThan(3);
    expect(await repairAll(kv)).toBeGreaterThan(3);
    const after = await scanWorkspace(kv);
    expect(after.filter((i) => i.severity === 'error')).toEqual([]);
    expect(after.filter((i) => i.repair)).toEqual([]);
    expect((await adapter.keys('quarantine/')).length).toBeGreaterThan(3);
    const season = JSON.parse((await adapter.get('season/n1/s1')) as string) as {
      data: { chapters: string[] };
    };
    expect(season.data.chapters).toEqual(['c1', 'c2']);
  });
});
