import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseChapterDocument, parseNovelManifest, parseSeasonManifest } from './schema.ts';

const sample = (path: string): unknown =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../../sample-novels/vertical-slice/${path}`, import.meta.url)),
      'utf8',
    ),
  );

describe('sample novel', () => {
  it('parses novel, season and chapter', () => {
    const novel = parseNovelManifest(sample('novel.json'));
    const season = parseSeasonManifest(sample('seasons/s01/season.json'));
    const chapter = parseChapterDocument(sample('seasons/s01/ch01.json'));
    expect(novel.ok && season.ok && chapter.ok).toBe(true);
    if (!chapter.ok) return;
    expect(chapter.value.blocks).toHaveLength(12);
    const kinds = new Set(chapter.value.blocks.map((b) => b.kind));
    expect(kinds).toEqual(new Set(['prose', 'dialogue', 'scene-break', 'module']));
  });
});

describe('malformed payloads', () => {
  const chapter = (blocks: unknown[]): unknown => ({
    id: 'ch01',
    seasonId: 's01',
    title: 'T',
    status: 'draft',
    blocks,
  });
  const id = '01M7WD7TG0SRH8FFJAF28FHTHC';

  it('rejects an unknown block kind', () => {
    const r = parseChapterDocument(chapter([{ id, kind: 'choice', text: 'Go left' }]));
    expect(r.ok).toBe(false);
  });

  it('rejects array-index style ids', () => {
    const r = parseChapterDocument(chapter([{ id: '3', kind: 'prose', text: 'x' }]));
    expect(r.ok).toBe(false);
  });

  it('rejects duplicate block ids', () => {
    const b = { id, kind: 'prose', text: 'x' };
    const r = parseChapterDocument(chapter([b, b]));
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.errors.join()).toMatch(/unique/);
  });

  it('rejects module blocks without a version', () => {
    const r = parseChapterDocument(
      chapter([{ id, kind: 'module', moduleId: 'bl-dice-3d', props: {} }]),
    );
    expect(r.ok).toBe(false);
  });

  it('rejects unknown section labels and newer schema versions', () => {
    const base = {
      schemaVersion: 1,
      id: 'x',
      title: 'X',
      author: 'A',
      sectionLabel: 'Season',
      theme: {},
      enabledModules: [],
      seasons: ['s01'],
    };
    expect(parseNovelManifest(base).ok).toBe(true);
    expect(parseNovelManifest({ ...base, sectionLabel: 'Folder' }).ok).toBe(false);
    expect(parseNovelManifest({ ...base, schemaVersion: 2 }).ok).toBe(false);
    expect(parseNovelManifest({ ...base, theme: { color: 'red' } }).ok).toBe(false);
  });

  it('reports a readable path for errors', () => {
    const r = parseSeasonManifest({ id: 's01', title: 'S', chapters: [], accentColor: 'teal' });
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.errors[0]).toMatch(/^accentColor:/);
  });
});
