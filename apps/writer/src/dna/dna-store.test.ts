import { DNA_ARCHETYPES, parseVisualDna } from '@kn/core/dna';
import { describe, expect, it } from 'vitest';
import {
  dnaFromNovel,
  matchingArchetype,
  patchDna,
  resolveNovelDna,
  serializeDna,
} from './dna-store.ts';

describe('dna store model', () => {
  it('defaults to editorial-minimal, noir-rain for Chrome Tide', () => {
    expect(dnaFromNovel({ id: 'x' })).toEqual(DNA_ARCHETYPES['editorial-minimal']);
    expect(dnaFromNovel({ id: 'vertical-slice' })).toEqual(DNA_ARCHETYPES['noir-rain']);
  });
  it('reads an archetype id or a full object, ignores garbage', () => {
    expect(dnaFromNovel({ id: 'x', visualDna: 'celestial-ink' })).toEqual(
      DNA_ARCHETYPES['celestial-ink'],
    );
    const custom = patchDna(DNA_ARCHETYPES['noir-rain'], 'palette', { hue: 12 });
    expect(dnaFromNovel({ id: 'x', visualDna: custom }).palette.hue).toBe(12);
    expect(dnaFromNovel({ id: 'x', visualDna: { palette: 1 } })).toEqual(
      DNA_ARCHETYPES['editorial-minimal'],
    );
  });
  it('serializes an unmodified preset as its id and a tuned one as an object', () => {
    expect(serializeDna(DNA_ARCHETYPES['antique-parchment'])).toBe('antique-parchment');
    const tuned = patchDna(DNA_ARCHETYPES['antique-parchment'], 'motion', { tempo: 1.7 });
    expect(matchingArchetype(tuned)).toBeNull();
    const out = serializeDna(tuned);
    expect(typeof out).toBe('object');
    expect(parseVisualDna(out).ok).toBe(true);
  });
  it('resolves live tokens for both themes', () => {
    const r = resolveNovelDna({ id: 'x', visualDna: 'noir-rain' }, 'light');
    expect(r.colors['--dna-bg']).toMatch(/^#[0-9a-f]{6}$/i);
    expect(r.tokens['--dna-radius']).toBeTruthy();
  });
});
