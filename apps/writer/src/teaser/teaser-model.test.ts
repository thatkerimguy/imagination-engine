import type { Block } from '@kn/core';
import { describe, expect, it } from 'vitest';
import {
  clampQuote,
  extractQuoteCandidates,
  gimmickBadge,
  quoteLayout,
  TEASER_PRESETS,
  TEASER_SIZE,
} from './teaser-model.ts';

const prose = (id: string, text: string): Block =>
  ({ id, kind: 'prose', text, beatStop: false }) as unknown as Block;
const dialogue = (id: string, text: string): Block =>
  ({ id, kind: 'dialogue', speaker: 'Mira', text, beatStop: false }) as unknown as Block;

const long = 'The tide came in quietly, and nobody on the pier noticed the water was rising.';

describe('presets and size', () => {
  it('exposes three presets and the 9:16 size', () => {
    expect(TEASER_PRESETS.map((p) => p.id)).toEqual(['midnight-ink', 'warm-paper', 'system-glow']);
    expect(TEASER_PRESETS[2]).toMatchObject({ background: '#0c2340', glow: '#3b82f6' });
    expect(TEASER_SIZE).toEqual({ width: 1080, height: 1920 });
  });
});

describe('clampQuote', () => {
  it('leaves short text and clamps long text with an ellipsis', () => {
    expect(clampQuote('Short one.')).toBe('Short one.');
    const out = clampQuote('word '.repeat(100));
    expect(out.length).toBeLessThanOrEqual(280);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('extractQuoteCandidates', () => {
  it('strips inline markup and skips short or non-text blocks', () => {
    const out = extractQuoteCandidates([
      prose('a', 'Hi.'),
      prose(
        'b',
        `The **tide** came in *quietly*, and ++nobody++ on the ~~pier~~ ==noticed== the water.`,
      ),
      { id: 'c', kind: 'scene-break', beatStop: false } as unknown as Block,
    ]);
    expect(out).toEqual(['The tide came in quietly, and nobody on the pier noticed the water.']);
  });

  it('prefers dialogue, caps at five, dedupes and is deterministic', () => {
    const blocks = [
      prose('p', long),
      dialogue('d', '“You were never supposed to find the lighthouse, Mira. Not you.”'),
      ...Array.from({ length: 8 }, (_, i) =>
        prose(`x${i}`, `${long} Variant number ${i} of the line.`),
      ),
      prose('dup', long),
    ];
    const a = extractQuoteCandidates(blocks);
    expect(a).toHaveLength(5);
    expect(a[0]).toContain('lighthouse');
    expect(new Set(a).size).toBe(5);
    expect(extractQuoteCandidates(blocks)).toEqual(a);
    expect(a.every((q) => q.length <= 280)).toBe(true);
  });

  it('returns nothing for an empty chapter', () => {
    expect(extractQuoteCandidates([])).toEqual([]);
  });
});

describe('layout and badge', () => {
  it('shrinks the font as the quote grows', () => {
    expect(quoteLayout(40).fontSize).toBeGreaterThan(quoteLayout(280).fontSize);
    expect(quoteLayout(100).lineHeight).toBeGreaterThan(quoteLayout(100).fontSize);
  });

  it('badge is undefined without a known gimmick', () => {
    expect(gimmickBadge([prose('a', long)])).toBeUndefined();
    expect(
      gimmickBadge([
        {
          id: 'm',
          kind: 'module',
          moduleId: 'nope',
          moduleVersion: 1,
          props: {},
        } as unknown as Block,
      ]),
    ).toBeUndefined();
  });
});
