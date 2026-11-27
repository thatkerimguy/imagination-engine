// Parity: the zero-dep reader guard must accept and reject exactly what the Zod schemas do.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseChapterDocument, parseNovelManifest, parseSeasonManifest } from '../schema.ts';
import { checkChapterDocument, checkNovelManifest, checkSeasonManifest } from './content.ts';

const read = (p: string): Record<string, unknown> =>
  JSON.parse(
    readFileSync(new URL(`../../../../sample-novels/vertical-slice/${p}`, import.meta.url), 'utf8'),
  ) as Record<string, unknown>;

const novel = read('novel.json');
const season = read('seasons/s01/season.json');
const chapter = read('seasons/s01/ch01.json');
const blocks = chapter.blocks as Record<string, unknown>[];
const withBlock = (i: number, patch: Record<string, unknown>): unknown => ({
  ...chapter,
  blocks: blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)),
});
const firstOf = (kind: string): number => blocks.findIndex((b) => b.kind === kind);

const novelCases: unknown[] = [
  novel,
  { ...novel, extra: 1, visualDna: { palette: {} } },
  { ...novel, id: 'Bad Id' },
  { ...novel, schemaVersion: 2 },
  { ...novel, seasons: [] },
  { ...novel, theme: { color: 'red' } },
  { ...novel, sectionLabel: 'Book' },
  { ...novel, title: '' },
  null,
];
const seasonCases: unknown[] = [
  season,
  { ...season, accentColor: '#abc' },
  { ...season, chapters: ['ok', 'NOT OK'] },
  { ...season, subtitle: 3 },
];
const chapterCases: unknown[] = [
  chapter,
  { ...chapter, blueprints: { x: {} }, visualDna: 'raw' },
  { ...chapter, blueprints: [] },
  { ...chapter, status: 'live' },
  withBlock(0, { id: 'nope' }),
  withBlock(0, { kind: 'poem' }),
  withBlock(firstOf('prose'), { style: 'shout' }),
  withBlock(firstOf('prose'), { text: '' }),
  withBlock(firstOf('module'), { moduleVersion: 0 }),
  withBlock(firstOf('module'), { props: [] }),
  withBlock(firstOf('module'), { beatStop: 'yes' }),
  { ...chapter, blocks: [...blocks, blocks[0]] },
];

describe('reader content guard ↔ Zod schema parity', () => {
  it.each(novelCases.map((c, i) => [i, c]))('novel case %i', (_, c) => {
    const z = parseNovelManifest(c);
    const g = checkNovelManifest(c);
    expect(g.ok).toBe(z.ok);
    if (z.ok && g.ok) expect(g.value).toEqual(z.value);
  });
  it.each(seasonCases.map((c, i) => [i, c]))('season case %i', (_, c) => {
    const z = parseSeasonManifest(c);
    const g = checkSeasonManifest(c);
    expect(g.ok).toBe(z.ok);
    if (z.ok && g.ok) expect(g.value).toEqual(z.value);
  });
  it.each(chapterCases.map((c, i) => [i, c]))('chapter case %i', (_, c) => {
    const z = parseChapterDocument(c);
    const g = checkChapterDocument(c);
    expect(g.ok).toBe(z.ok);
    if (z.ok && g.ok) expect(g.value).toEqual(z.value);
  });
});
