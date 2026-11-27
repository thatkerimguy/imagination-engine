import { describe, expect, it } from 'vitest';
import { NODE_KIND_META, nodeKindLabel } from './node-kind.ts';

describe('node-kind', () => {
  it('maps story kinds to their labels and Feather icons', () => {
    expect(nodeKindLabel('character')).toBe('Character');
    expect(nodeKindLabel('location')).toBe('Location');
    expect(nodeKindLabel('lore')).toBe('Lore');
    expect(NODE_KIND_META.character.icon).toBe('user');
    expect(NODE_KIND_META.location.icon).toBe('map-pin');
    expect(NODE_KIND_META.lore.icon).toBe('book-open');
  });

  it('covers structural kinds', () => {
    expect(nodeKindLabel('book')).toBe('Book');
    expect(NODE_KIND_META.season.icon).toBe('layers');
    expect(NODE_KIND_META.folder.icon).toBe('folder');
    expect(nodeKindLabel('chapter', 'en')).toBe('Chapter');
  });
});
