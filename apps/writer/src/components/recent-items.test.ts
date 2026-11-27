import { describe, expect, it } from 'vitest';
import { recentItems } from './recent-items.ts';

describe('recentItems', () => {
  it('carries the doc story kind and sorts newest first', () => {
    const out = recentItems({
      chapters: [
        { novelId: 'n', seasonId: 's', id: 'c1', title: 'One', book: 'Tide', updatedAt: 100 },
      ],
      docs: [
        { id: 'd1', title: 'Mara', folderId: null, updatedAt: 300, kind: 'character' },
        { id: 'd2', title: 'Port', folderId: 'f', updatedAt: 200, kind: 'location' },
        { id: 'd3', title: 'Plain', folderId: null, updatedAt: 50 },
      ],
      meta: new Map(),
    });
    expect(out.map((r) => r.id)).toEqual(['d1', 'd2', 'c1', 'd3']);
    expect(out.map((r) => r.docKind)).toEqual(['character', 'location', undefined, 'note']);
  });
});
