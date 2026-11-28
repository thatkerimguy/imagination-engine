// Custom pack blueprints: prepareChapter inlines the full blueprint JSON from the SQLite catalog,
// and every exporter renders the cue through that inlined copy.
import type { ChapterDocument, ModuleBlock } from '@kn/core';
import type { GimmickBlueprint } from '@kn/core/gimmicks';
import { starterBlueprint } from '@kn/engines/blueprints';
import { describe, expect, it } from 'vitest';
import { CatalogRepository } from '../db/catalog-repo.ts';
import { createMemoryDatabase } from '../db/memory-driver.ts';
import { DEFAULT_EXPORT_OPTIONS, type CompiledBook } from '../export/book-model.ts';
import { chapterXhtml } from '../export/epub-xhtml.ts';
import { gimmickLines, renderCue } from '../export/gimmick-text.ts';
import { buildRoyalRoadHtml } from '../export/royal-road.ts';
import { catalogResolver } from './blueprint-resolver.ts';
import { prepareChapter } from './sanitize.ts';

const ID = '01HZZZZZZZZZZZZZZZZZZZZZZZ';
const seed = starterBlueprint('system-notification')!;
const custom: GimmickBlueprint = {
  ...seed,
  id: 'pack-custom-01',
  name: 'Custom Pack Cue',
  exports: {
    ...seed.exports,
    transcript: 'PACK: {{title}}',
    summary: '{{title}}',
    royalRoadHtml: '<p>RR-PACK {{title}}</p>',
    epubXhtml: '<p>EPUB-PACK {{title}}</p>',
  },
};
const cue: ModuleBlock = {
  id: ID,
  kind: 'module',
  moduleId: custom.engine,
  moduleVersion: 1,
  props: { blueprintId: custom.id, ...custom.defaultProps, title: 'Hello' },
};
const draft: ChapterDocument = {
  id: 'c1',
  seasonId: 's1',
  title: 'T',
  status: 'draft',
  blocks: [cue],
};

async function prepared() {
  const db = createMemoryDatabase();
  await new CatalogRepository(db).install([
    { id: 'pack-custom', genre: 'core', title: 'Custom', version: 1, blueprints: [custom] },
  ]);
  const res = prepareChapter(draft, await catalogResolver(db, [draft]));
  if (!res.ok) throw new Error(res.errors.join());
  return res.chapter;
}

describe('prepareChapter blueprint inlining', () => {
  it('without a catalog an unknown pack id is simply not inlined', () => {
    const res = prepareChapter(draft);
    expect(res.ok && res.chapter.blueprints).toBeFalsy();
  });

  it('inlines starters by default and the full catalog blueprint when resolved', async () => {
    const starter = prepareChapter({
      ...draft,
      blocks: [{ ...cue, props: { blueprintId: seed.id, ...seed.defaultProps } }],
    });
    expect(starter.ok && Object.keys(starter.chapter.blueprints ?? {})).toEqual([seed.id]);
    const chapter = await prepared();
    expect(chapter.blueprints?.['pack-custom-01']).toEqual(JSON.parse(JSON.stringify(custom)));
  });

  it('exporters render the pack cue via the inlined blueprint', async () => {
    const chapter = await prepared();
    const inline = chapter.blueprints;
    expect(renderCue(cue, 'transcript')).toBeNull();
    expect(gimmickLines(cue, 'transcript', inline)).toEqual([{ text: 'PACK: Hello' }]);
    const section = {
      id: 'c1',
      title: 'T',
      blocks: chapter.blocks,
      styles: {},
      blueprints: inline,
      showTitle: false,
    };
    const book: CompiledBook = { title: 'B', author: 'A', sections: [section] };
    expect(buildRoyalRoadHtml(book, { ...DEFAULT_EXPORT_OPTIONS, titlePage: false })).toContain(
      '<p>RR-PACK Hello</p>',
    );
    expect(chapterXhtml(section, 0, DEFAULT_EXPORT_OPTIONS, 'en')).toContain(
      '<p>EPUB-PACK Hello</p>',
    );
  });
});
