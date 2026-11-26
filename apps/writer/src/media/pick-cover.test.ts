import { describe, expect, it } from 'vitest';
import { importCover, type CoverDeps } from './cover-pipeline.ts';

const SRC = { uri: 'file:///cache/picked.png', width: 3000, height: 4500 };

function harness(opts: { failCover?: boolean; failThumb?: boolean } = {}) {
  const renders: { uri: string; maxWidth: number }[] = [];
  const moves: { from: string; name: string }[] = [];
  const copies: string[] = [];
  const warns: string[] = [];
  const deps: CoverDeps = {
    async render(src, target) {
      renders.push({ uri: src.uri, maxWidth: target.maxWidth });
      const isCover = target.maxWidth === 1200;
      if (isCover ? opts.failCover : opts.failThumb) throw new Error('Loading bitmap failed');
      return { uri: `file:///cache/out-${target.maxWidth}.jpg`, width: target.maxWidth, height: 1 };
    },
    move(from, name) {
      moves.push({ from, name });
      return { uri: `file:///docs/covers/${name}`, bytes: 1234 };
    },
    copyOriginal(src, id) {
      copies.push(src);
      return { uri: `file:///docs/covers/${id}.png`, bytes: 99, ext: 'png' };
    },
    newId: () => 'abc',
    warn: (m) => warns.push(m),
  };
  return { deps, renders, moves, copies, warns };
}

describe('importCover', () => {
  it('renders both files from the source asset, then moves them as <id>.jpg / <id>.thumb.jpg', async () => {
    const h = harness();
    const r = await importCover(SRC, h.deps);
    expect(h.renders.map((x) => x.uri)).toEqual([SRC.uri, SRC.uri]);
    expect(h.renders.map((x) => x.maxWidth)).toEqual([1200, 240]);
    expect(h.moves.map((m) => m.name)).toEqual(['abc.jpg', 'abc.thumb.jpg']);
    expect(h.renders.every((x) => !x.uri.includes('/docs/covers/'))).toBe(true);
    expect(r.cover).toMatchObject({ uri: 'file:///docs/covers/abc.jpg', bytes: 1234 });
    expect(r.thumb).toMatchObject({
      uri: 'file:///docs/covers/abc.thumb.jpg',
      mimeType: 'image/jpeg',
    });
  });

  it('keeps the cover with thumb null when the thumbnail render throws', async () => {
    const h = harness({ failThumb: true });
    const r = await importCover(SRC, h.deps);
    expect(r.thumb).toBeNull();
    expect(r.cover.uri).toBe('file:///docs/covers/abc.jpg');
    expect(h.moves.map((m) => m.name)).toEqual(['abc.jpg']);
    expect(h.warns).toHaveLength(1);
  });

  it('copies the original with thumb null when the cover render throws', async () => {
    const h = harness({ failCover: true });
    const r = await importCover(SRC, h.deps);
    expect(h.copies).toEqual([SRC.uri]);
    expect(h.moves).toHaveLength(0);
    expect(r.thumb).toBeNull();
    expect(r.cover).toMatchObject({ uri: 'file:///docs/covers/abc.png', mimeType: 'image/png' });
  });
});
