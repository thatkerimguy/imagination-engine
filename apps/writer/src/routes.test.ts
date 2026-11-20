import { describe, expect, it } from 'vitest';
import { parentHref, routes } from './routes.ts';

describe('parentHref', () => {
  it('has no parent for the bookshelf', () => {
    expect(parentHref('/', {})).toBeNull();
  });
  it('walks the Book → Chapter hierarchy', () => {
    expect(parentHref('/novel/n1', {})).toBe('/');
    expect(parentHref('/novel/n1/settings', {})).toBe('/novel/n1');
    expect(parentHref(routes.chapter('n1', 's1', 'c1'), {})).toBe('/novel/n1');
  });
  it('returns from preview to its chapter', () => {
    expect(parentHref('/preview', { novel: 'n1', season: 's1', chapter: 'c1' })).toBe(
      routes.chapter('n1', 's1', 'c1'),
    );
    expect(parentHref('/preview', {})).toBe('/');
  });
  it('sends other screens to the shelf', () => {
    expect(parentHref('/settings', {})).toBe('/');
    expect(parentHref('/new-novel', {})).toBe('/');
  });
});
