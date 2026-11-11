import { describe, expect, it } from 'vitest';
import { BLOCK_MENU } from '../project/factory.ts';
import { BLOCK_GROUPS, filterEntries, type PickerEntry } from './block-groups.ts';

describe('block groups', () => {
  it('place every menu block in exactly one group', () => {
    const grouped = Object.values(BLOCK_GROUPS).flat();
    expect([...grouped].sort()).toEqual([...BLOCK_MENU].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });
});

describe('filterEntries', () => {
  const entries: PickerEntry[] = [
    { type: 'music', group: 'sound', label: 'Music', hint: 'Play a song' },
    { type: 'sfx', group: 'sound', label: 'Sound effect', hint: 'A short sound' },
    { type: 'narration', group: 'write', label: 'Anlatım', hint: 'Bir satır metin' },
    { type: 'if', group: 'choices', label: 'İf', hint: 'Only when something is true' },
  ];

  it('keeps everything for an empty search', () => {
    expect(filterEntries(entries, '  ')).toHaveLength(4);
  });

  it('matches the start of any word in the name, then the hint', () => {
    expect(filterEntries(entries, 'eff').map((e) => e.type)).toEqual(['sfx']);
    expect(filterEntries(entries, 'so').map((e) => e.type)).toEqual(['sfx', 'music', 'if']);
  });

  it('ignores case, accents and Turkish dotted i', () => {
    expect(filterEntries(entries, 'anlatim').map((e) => e.type)).toEqual(['narration']);
    expect(filterEntries(entries, 'IF').map((e) => e.type)).toEqual(['if']);
  });
});
