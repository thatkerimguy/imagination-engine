import { describe, expect, it } from 'vitest';
import {
  computeTodayWords,
  countWords,
  extractAllNodeLinks,
  extractMentionTargets,
  extractWikilinkTargets,
  findWikilinks,
  renderWikilinks,
  extractPlainText,
  isDescendant,
  NODE_KINDS,
  sortNodes,
  WORKSPACE_MODES,
} from './index.ts';

const n = (id: string, position: number, createdAt = '2026-01-01T00:00:00.000Z') => ({
  id,
  position,
  createdAt,
});

describe('v2 node contract', () => {
  it('lists every node kind and workspace mode', () => {
    expect(NODE_KINDS).toEqual([
      'book',
      'season',
      'chapter',
      'folder',
      'note',
      'character',
      'location',
      'lore',
    ]);
    expect(WORKSPACE_MODES).toEqual(['prose', 'interactive']);
  });
});

describe('sortNodes', () => {
  it('orders by position, then creation time, then id, without mutating', () => {
    const input = [n('c', 2), n('b', 1, '2026-02-01T00:00:00.000Z'), n('a', 1), n('d', 1)];
    expect(sortNodes(input).map((x) => x.id)).toEqual(['a', 'd', 'b', 'c']);
    expect(input[0]!.id).toBe('c');
  });
});

describe('isDescendant', () => {
  const parent = new Map<string, string | null>([
    ['book', null],
    ['season', 'book'],
    ['chapter', 'season'],
    ['loopA', 'loopB'],
    ['loopB', 'loopA'],
  ]);
  const of = (id: string) => parent.get(id);
  it('walks every ancestor', () => {
    expect(isDescendant(of, 'chapter', 'book')).toBe(true);
    expect(isDescendant(of, 'chapter', 'season')).toBe(true);
    expect(isDescendant(of, 'book', 'chapter')).toBe(false);
    expect(isDescendant(of, 'book', 'book')).toBe(false);
  });
  it('survives a parent cycle', () => {
    expect(isDescendant(of, 'loopA', 'book')).toBe(false);
  });
});

describe('extractPlainText', () => {
  it('keeps prose, dialogue speakers and scene labels; drops markup and modules', () => {
    const text = extractPlainText([
      { kind: 'prose', text: 'The **tide** {fg:#ff0000}rose{/fg}{{comment:x}}.' },
      { kind: 'dialogue', speaker: 'Mira', text: '*Run.*' },
      { kind: 'scene-break', label: 'Later' },
      { kind: 'module' },
    ]);
    expect(text).toBe('The tide rose.\nMira: Run.\nLater');
    expect(countWords(text)).toBe(6);
  });
  it('accepts a custom stripper', () => {
    expect(extractPlainText([{ kind: 'prose', text: 'abc' }], (s) => s.toUpperCase())).toBe('ABC');
  });
});

describe('extractMentionTargets', () => {
  const notes = [
    { id: 'mill', title: 'Old Mill' },
    { id: 'old', title: 'Old' },
    { id: 'mira', title: 'Mira Okafor' },
    { id: 'blank', title: '  ' },
  ];
  it('finds @Title mentions, longest title first, accent and case-insensitive', () => {
    expect(extractMentionTargets('We met at @old mill. Then (@MÍRA OKAFOR) left.', notes)).toEqual([
      'mira',
      'mill',
    ]);
  });
  it('ignores emails and partial words', () => {
    expect(extractMentionTargets('mail a@old.com or @Oldest', notes)).toEqual([]);
    expect(extractMentionTargets('@Old, then', notes)).toEqual(['old']);
  });
});

describe('computeTodayWords', () => {
  const log = (nodeId: string, dateKey: string, wordCount: number, isBaseline = false, t = 0) => ({
    nodeId,
    dateKey,
    wordCount,
    isBaseline,
    recordedAt: `${dateKey}T10:00:${String(t).padStart(2, '0')}.000Z`,
  });
  it('subtracts the day-0 baseline: 3 typed words in a 118-word chapter = 3', () => {
    const logs = [log('c1', '2026-11-26', 118, true, 0), log('c1', '2026-11-26', 121, false, 1)];
    expect(computeTodayWords(logs, '2026-11-26')).toBe(3);
  });
  it('falls back to the latest prior-day snapshot, then zero', () => {
    const logs = [
      log('c1', '2026-11-24', 50),
      log('c1', '2026-11-25', 80),
      log('c1', '2026-11-26', 95),
      log('c2', '2026-11-26', 12),
    ];
    expect(computeTodayWords(logs, '2026-11-26')).toBe(15 + 12);
  });
  it('a fresh baseline alone counts zero; deletions never go negative', () => {
    expect(computeTodayWords([log('c1', '2026-11-26', 400, true)], '2026-11-26')).toBe(0);
    const cut = [log('c1', '2026-11-25', 100), log('c1', '2026-11-26', 60)];
    expect(computeTodayWords(cut, '2026-11-26')).toBe(0);
  });
  it('ignores future days and nodes with nothing today', () => {
    const logs = [log('c1', '2026-11-25', 10), log('c1', '2026-11-27', 99)];
    expect(computeTodayWords(logs, '2026-11-26')).toBe(0);
  });
});

describe('wikilinks + mentions (extractAllNodeLinks)', () => {
  const nodes = [
    { id: 'harbour', title: 'Harbour District' },
    { id: 'harb', title: 'Harbour' },
    { id: 'lantern', title: 'Lantern Room' },
    { id: 'snake', title: 'Snake Eyes' },
  ];
  it('resolves [[Title]] case-insensitively to the exact title', () => {
    expect(extractWikilinkTargets('Down to the [[harbour district]].', nodes)).toEqual(['harbour']);
    expect(extractWikilinkTargets('[[Harbour Dist]] is not a title', nodes)).toEqual([]);
  });
  it('resolves [[Title|Alias]] by title and renders the alias', () => {
    const text = 'Meet me on [[Harbour District|the quays]].';
    expect(extractAllNodeLinks(text, nodes)).toEqual([
      { targetId: 'harbour', relation: 'reference' },
    ]);
    expect(findWikilinks(text)).toEqual([
      { title: 'Harbour District', alias: 'the quays', start: 11, end: 41 },
    ]);
    expect(renderWikilinks(text)).toBe('Meet me on the quays.');
    expect(renderWikilinks('[[Lantern Room]] and [[ ]]')).toBe('Lantern Room and [[ ]]');
  });
  it('resolves @Title mentions, longest match wins', () => {
    const found = extractAllNodeLinks('Up in the @Lantern Room, near @Harbour District', nodes);
    expect(found.filter((l) => l.targetId === 'harb')).toEqual([]);
    expect(found).toHaveLength(2);
    expect(found).toEqual(
      expect.arrayContaining([
        { targetId: 'lantern', relation: 'mention' },
        { targetId: 'harbour', relation: 'mention' },
      ]),
    );
  });
  it('mixes both forms, dedupes targets and ignores emails', () => {
    const text =
      '[[Snake Eyes]] at @harbour district, mail me@harbour.com, again [[snake eyes]] @Snake Eyes';
    expect(extractAllNodeLinks(text, nodes)).toEqual([
      { targetId: 'snake', relation: 'reference' },
      { targetId: 'harbour', relation: 'mention' },
    ]);
    expect(extractAllNodeLinks('write to a@Harbour.org', nodes)).toEqual([]);
  });
  it('never reads a wikilink body as a mention', () => {
    expect(extractAllNodeLinks('[[@Harbour]]', nodes)).toEqual([]);
  });
});
