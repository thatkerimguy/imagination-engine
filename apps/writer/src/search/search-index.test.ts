import type { Block } from '@kn/core';
import { describe, expect, it } from 'vitest';
import { buildSearchIndex, search, type SearchSources } from './search-index.ts';

const prose = (id: string, text: string): Block => ({ id, kind: 'prose', text });

function sources(over: Partial<SearchSources> = {}): SearchSources {
  return {
    novels: [{ id: 'n1', title: 'Chrome Tide' }],
    chapters: [
      {
        novelId: 'n1',
        novelTitle: 'Chrome Tide',
        seasonId: 's1',
        chapterId: 'c1',
        title: 'Low Tide',
        blocks: [
          prose('b1', 'The harbour smelled of **brine** and old rope.'),
          { id: 'b2', kind: 'dialogue', speaker: 'Mara', text: 'Lighthouse is dark again.' },
          { id: 'b3', kind: 'scene-break', label: 'Midnight' },
        ],
      },
      {
        novelId: 'n1',
        novelTitle: 'Chrome Tide',
        seasonId: 's1',
        chapterId: 'c2',
        title: 'Café Nights',
        blocks: [prose('b4', 'She ordered a café noir near the harbour wall.')],
      },
    ],
    folders: [{ id: 'f1', title: 'Worldbuilding', parentFolderId: null }],
    docs: [
      {
        id: 'd1',
        title: 'Harbour notes',
        folderId: 'f1',
        blocks: [prose('x1', 'Secret passphrase: zephyr.')],
      },
    ],
    meta: new Map(),
    ...over,
  };
}

describe('search', () => {
  it('matches across chapters with block targets', () => {
    const r = search(buildSearchIndex(sources()), 'harbour', { scope: 'chapters' });
    expect(r.map((x) => x.id)).toEqual(['c1', 'c2']);
    expect(r[0]?.target).toMatchObject({ chapterId: 'c1', blockId: 'b1' });
  });

  it('requires every term (AND)', () => {
    const idx = buildSearchIndex(sources());
    expect(search(idx, 'harbour rope')).toHaveLength(1);
    expect(search(idx, 'harbour zzz')).toHaveLength(0);
  });

  it('highlights offsets slice back to the matched term', () => {
    const [hit] = search(buildSearchIndex(sources()), 'BRINE');
    expect(hit?.highlights).toHaveLength(1);
    const [a, b] = hit?.highlights[0] ?? [0, 0];
    expect(hit?.excerpt.slice(a, b).toLowerCase()).toBe('brine');
  });

  it('centres long excerpts on the hit and keeps offsets right', () => {
    const long = `${'lorem ipsum '.repeat(40)}needle ${'dolor sit '.repeat(40)}`;
    const s = sources({ chapters: [{ ...sources().chapters[0]!, blocks: [prose('b9', long)] }] });
    const [hit] = search(buildSearchIndex(s), 'needle', { scope: 'chapters' });
    expect(hit && hit.excerpt.length).toBeLessThan(125);
    const [a, b] = hit?.highlights[0] ?? [0, 0];
    expect(hit?.excerpt.slice(a, b)).toBe('needle');
  });

  it('strips inline markup and ignores diacritics', () => {
    const idx = buildSearchIndex(sources());
    expect(search(idx, 'brine and')[0]?.excerpt).not.toContain('*');
    const [hit] = search(idx, 'cafe', { scope: 'chapters' });
    const [a, b] = hit?.titleHighlights[0] ?? hit?.highlights[0] ?? [0, 0];
    expect((hit?.excerpt || hit?.title || '').slice(a, b).toLowerCase()).toBe('café');
  });

  it('finds dialogue speakers and scene-break labels', () => {
    const idx = buildSearchIndex(sources());
    expect(search(idx, 'mara')[0]?.target).toMatchObject({ blockId: 'b2' });
    expect(search(idx, 'midnight')[0]?.target).toMatchObject({ blockId: 'b3' });
  });

  it('redacts locked items to their title only', () => {
    const idx = buildSearchIndex(sources(), { isLocked: (id) => id === 'd1' });
    expect(search(idx, 'zephyr')).toHaveLength(0);
    const [t] = search(idx, 'harbour notes');
    expect(t).toMatchObject({ id: 'd1', locked: true, excerpt: '' });
  });

  it('locked chapters inside a locked novel hide their prose', () => {
    const idx = buildSearchIndex(sources(), { isLocked: (id) => id === 'n1' });
    expect(search(idx, 'brine')).toHaveLength(0);
    expect(search(idx, 'low tide')).toHaveLength(1);
  });

  it('filters by scope', () => {
    const idx = buildSearchIndex(sources());
    expect(search(idx, 'harbour', { scope: 'notes' }).map((r) => r.kind)).toEqual(['doc']);
    expect(search(idx, 'worldbuilding', { scope: 'chapters' })).toHaveLength(0);
    expect(search(idx, 'worldbuilding', { scope: 'notes' })[0]?.kind).toBe('folder');
  });

  it('builds and queries a 20-chapter fixture in under 50 ms', () => {
    const words = ['tide', 'rope', 'lamp', 'salt', 'glass', 'engine', 'silver', 'quiet'];
    const chapters = Array.from({ length: 20 }, (_, i) => ({
      novelId: 'n1',
      novelTitle: 'Chrome Tide',
      seasonId: 's1',
      chapterId: `c${i}`,
      title: `Chapter ${i}`,
      blocks: Array.from({ length: 50 }, (_, j) =>
        prose(
          `b${i}-${j}`,
          `${words[(i + j) % 8]} and the ${words[(j * 3) % 8]} were *quiet* ${'lorem ipsum '.repeat(25)}`,
        ),
      ),
    }));
    const t0 = performance.now();
    const idx = buildSearchIndex(sources({ chapters }));
    const r = search(idx, 'silver glass');
    expect(performance.now() - t0).toBeLessThan(50);
    expect(r.length).toBeGreaterThan(0);
  });
});
