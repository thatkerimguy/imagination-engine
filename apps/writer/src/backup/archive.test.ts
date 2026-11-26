import { describe, expect, it, vi } from 'vitest';
import { bytesOf, unzipFiles, zipFiles, type ZipFiles } from '../export/zip.ts';
import { MAX_COVER_BYTES, isSafeCoverName } from './archive-covers.ts';
import { LIMITS } from './archive-format.ts';
import { packWorkspace, restoreWorkspace } from './archive.ts';
import { memMedia, newRepo, NOW, seeded } from './archive-fixtures.ts';

describe('workspace archive', () => {
  it('round-trips tables, covers + thumbnails and search; secrets never travel', async () => {
    const { repo, novel, files } = await seeded();
    const bytes = await packWorkspace(repo, NOW, memMedia('', files));
    const zip = await unzipFiles(bytes);
    const names = Object.keys(zip);
    expect(names).toEqual(
      expect.arrayContaining([
        'manifest.json',
        'tables/nodes.json',
        'covers/abc123.jpg',
        'covers/abc123.thumb.jpg',
      ]),
    );
    expect(JSON.parse(new TextDecoder().decode(zip['manifest.json']!)).formatVersion).toBe(2);
    const settingsJson = new TextDecoder().decode(zip['tables/settings.json']!);
    for (const leak of ['lock', 'publish-secret', 'TOKEN', 'SECRET', 'quarantine/'])
      expect(settingsJson).not.toContain(leak);
    expect(settingsJson).toContain('setting/publish');

    const target = newRepo('file:///new/');
    await target.db.setSetting('setting/lock', '"mine"');
    await target.db.setSetting('setting/publish-secret', '"my-token"');
    await target.db.setSetting('setting/stale', '1');
    const written = new Map<string, Uint8Array>();
    const changed = vi.fn();
    target.subscribe(changed);
    await restoreWorkspace(target, bytes, memMedia('file:///new/covers/', written));
    expect(changed).toHaveBeenCalled();
    expect(await target.db.getSetting('setting/lock')).toBe('"mine"');
    expect(await target.db.getSetting('setting/publish-secret')).toBe('"my-token"');
    expect(await target.db.getSetting('setting/stale')).toBeNull();
    expect(await target.db.getSetting('setting/lock-pin')).toBeNull();
    expect([...written.get('file:///new/covers/abc123.jpg')!]).toEqual([1, 2, 3]);
    expect([...written.get('file:///new/covers/abc123.thumb.jpg')!]).toEqual([4]);
    const node = (await target.db.getNode(novel.id))!;
    const asset = (await target.db.getMediaAsset(node.coverAssetId!))!;
    expect(asset.relativePath).toBe('covers/abc123.jpg');
    expect((await target.db.getMediaAsset(`${node.coverAssetId}-thumb`))!.relativePath).toBe(
      'covers/abc123.thumb.jpg',
    );
    expect((await target.db.search('lighthouse')).map((h) => h.nodeId).length).toBe(1);
    expect((await target.db.integrity()).ftsRows).toBe((await target.db.integrity()).activeNodes);
    expect((await target.exportNovel(novel.id)).seasons[0]!.chapters[0]!.blocks).toHaveLength(1);
  });

  it('refuses unsafe archives and leaves the database untouched', async () => {
    const { repo } = await seeded();
    const base = await unzipFiles(await packWorkspace(repo, NOW));
    const target = newRepo();
    await target.db.setSetting('setting/keep', '1');
    const before = await target.db.exportTables();
    const reject = async (extra: ZipFiles, re: RegExp) => {
      await expect(restoreWorkspace(target, await zipFiles({ ...base, ...extra }))).rejects.toThrow(
        re,
      );
      expect(await target.db.exportTables()).toEqual(before);
    };
    for (const bad of ['covers/../evil.jpg', 'covers/x.sh', 'covers/a/b.jpg', 'covers/.hidden.jpg'])
      await reject({ [bad]: new Uint8Array([1]) }, /cover/i);
    await reject({ 'covers/a.jpg': new Uint8Array(MAX_COVER_BYTES + 1) }, /too large/);
    await reject({ '../evil.json': bytesOf('[]') }, /Unsafe entry/);
    await reject({ '/abs.json': bytesOf('[]') }, /Unsafe entry/);
    await reject({ 'tables\\x.json': bytesOf('[]') }, /Unsafe entry/);
    await reject({ 'kv/doc/x': bytesOf('{}') }, /Unexpected entry/);
    await reject({ 'tables/settings.json': bytesOf('{not json') }, /not valid JSON/);
    const many: ZipFiles = {};
    for (let i = 0; i <= LIMITS.entries; i++) many[`covers/c${i}.jpg`] = new Uint8Array([1]);
    await reject(many, /too many/);
    const nodes = JSON.parse(new TextDecoder().decode(base['tables/nodes.json']!)) as {
      kind: string;
    }[];
    await reject(
      {
        'tables/nodes.json': bytesOf(JSON.stringify(nodes.map((n) => ({ ...n, kind: 'dragon' })))),
      },
      /node kind/,
    );
    const secret = [{ key: 'setting/lock', valueJson: '1', updatedAt: 'x' }];
    await reject({ 'tables/settings.json': bytesOf(JSON.stringify(secret)) }, /can restore/);
    await expect(
      restoreWorkspace(target, await zipFiles({ 'a.txt': bytesOf('x') })),
    ).rejects.toThrow();
    expect(isSafeCoverName('01m8ajx-a.thumb.jpg')).toBe(true);
  });

  it('refuses a chapter whose blocks fail the core schema', async () => {
    const { repo } = await seeded();
    const base = await unzipFiles(await packWorkspace(repo, NOW));
    const bodies = JSON.parse(new TextDecoder().decode(base['tables/node_bodies.json']!)) as {
      blocksJson: string;
    }[];
    bodies[0]!.blocksJson = JSON.stringify([{ id: 'nope', kind: 'prose', text: 'x' }]);
    await expect(
      restoreWorkspace(
        newRepo(),
        await zipFiles({ ...base, 'tables/node_bodies.json': bytesOf(JSON.stringify(bodies)) }),
      ),
    ).rejects.toThrow(/Chapter/);
  });

  it('rolls back atomically when the database rejects the rows (broken parent)', async () => {
    const { repo } = await seeded();
    const base = await unzipFiles(await packWorkspace(repo, NOW));
    const nodes = JSON.parse(new TextDecoder().decode(base['tables/nodes.json']!)) as {
      kind: string;
      parentId: string | null;
    }[];
    const broken = nodes.map((n) => (n.kind === 'season' ? { ...n, parentId: 'ghost' } : n));
    const target = newRepo();
    await target.db.setSetting('setting/keep', '1');
    const before = await target.db.exportTables();
    await expect(
      restoreWorkspace(
        target,
        await zipFiles({ ...base, 'tables/nodes.json': bytesOf(JSON.stringify(broken)) }),
      ),
    ).rejects.toThrow();
    expect(await target.db.exportTables()).toEqual(before);
  });

  it('rejects a v1 key-value archive with a clear error', async () => {
    const v1 = { app: 'kinetic-novel-writer', kind: 'workspace', version: 1, keyCount: 0 };
    await expect(
      restoreWorkspace(newRepo(), await zipFiles({ 'manifest.json': bytesOf(JSON.stringify(v1)) })),
    ).rejects.toThrow(/Unsupported backup version/);
  });
});
