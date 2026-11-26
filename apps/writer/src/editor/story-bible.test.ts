import type { Block } from '@kn/core';
import { describe, expect, it } from 'vitest';
import {
  activeMention,
  extractMentions,
  insertMention,
  matchNotes,
  noteExcerpt,
} from './story-bible.ts';

describe('activeMention', () => {
  it('finds a token at the cursor', () => {
    expect(activeMention('Hello @Ma', 9)).toEqual({ trigger: '@', query: 'Ma', start: 6, end: 9 });
    expect(activeMention('@', 1)).toEqual({ trigger: '@', query: '', start: 0, end: 1 });
    expect(activeMention('see @Old Mi', 11)?.query).toBe('Old Mi');
  });
  it('ignores emails, finished tokens and far-away @', () => {
    expect(activeMention('mail a@b.com', 12)).toBeNull();
    expect(activeMention('hi @Mara, then', 14)).toBeNull();
    expect(activeMention('no at', 5)).toBeNull();
    expect(activeMention('@Mara  x', 8)).toBeNull();
  });
});

describe('activeMention wikilinks', () => {
  it('detects an unfinished [[query', () => {
    expect(activeMention('See [[Harb', 10)).toEqual({
      trigger: '[[',
      query: 'Harb',
      start: 4,
      end: 10,
    });
    expect(activeMention('[[', 2)?.trigger).toBe('[[');
    expect(activeMention('x[[Old Mi', 9)?.query).toBe('Old Mi');
  });
  it('ignores closed wikilinks and prefers the nearer trigger', () => {
    expect(activeMention('See [[Harbour]] now', 19)).toBeNull();
    expect(activeMention('[[Mara and @Ha', 14)?.trigger).toBe('@');
    expect(activeMention('@Mara [[Ha', 10)?.trigger).toBe('[[');
  });
});

describe('matchNotes', () => {
  const notes = [
    { id: '1', title: 'The Old Mill' },
    { id: '2', title: 'Mara' },
    { id: '3', title: 'Marble Hall', folderPath: 'Places' },
    { id: '4', title: 'Smart Mara' },
  ];
  it('puts prefix matches first, case-insensitively', () => {
    expect(matchNotes(notes, 'mar').map((n) => n.id)).toEqual(['2', '3', '4']);
  });
  it('honours the limit and empty query', () => {
    expect(matchNotes(notes, '', 2)).toHaveLength(2);
    expect(matchNotes(notes, 'zzz')).toEqual([]);
  });
});

describe('extractMentions', () => {
  const blocks = [
    { id: 'a', kind: 'prose', text: 'She met @Old Mill Keeper and @Mara.' },
    { id: 'b', kind: 'dialogue', speaker: 'X', text: '@Mara again, @old mill keeper, a@Mara' },
    { id: 'c', kind: 'scene-break' },
  ] as Block[];
  it('uses longest title, unique, first-seen order', () => {
    expect(extractMentions(blocks, ['Mara', 'Old Mill', 'Old Mill Keeper', 'Nobody'])).toEqual([
      'Old Mill Keeper',
      'Mara',
    ]);
  });
});

describe('insertMention', () => {
  it('replaces the token and places the cursor after it', () => {
    const text = 'Hi @Ma there';
    const m = activeMention(text, 6)!;
    expect(insertMention(text, m, 'Mara')).toEqual({ text: 'Hi @Mara there', cursor: 9 });
  });
  it('inserts [[Title]] for the wikilink trigger, reusing a closing ]]', () => {
    const m = activeMention('Go [[Ha]] now', 7)!;
    expect(insertMention('Go [[Ha]] now', m, 'Harbour')).toEqual({
      text: 'Go [[Harbour]] now',
      cursor: 14,
    });
  });
});

describe('noteExcerpt', () => {
  it('strips markup, skips breaks and truncates', () => {
    const blocks = [
      { kind: 'prose', text: '**Mara** is {fg:#ff0000}tall{/fg}.' },
      { kind: 'scene-break' },
      { kind: 'prose', text: 'Second.' },
    ];
    expect(noteExcerpt(blocks)).toBe('Mara is tall.\n\nSecond.');
    expect(noteExcerpt([{ kind: 'prose', text: 'word '.repeat(50) }], 40).endsWith('…')).toBe(true);
  });
});
