import { createTranslator } from '@ie/i18n';
import { samples } from '@ie/samples';
import { compileStory } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { checkText, costText, endingIds, lockText, oddsText } from './labels.ts';
import { presentMessages } from './messages.ts';

const story = compileStory(samples.rainAlley);
const en = createTranslator(presentMessages, 'en');
const tr = createTranslator(presentMessages, 'tr');

describe('reader labels', () => {
  it('explains a requirement in both languages', () => {
    const lock = {
      kind: 'requirement',
      requirement: { var: 'charisma', op: '>=', value: 6 },
    } as const;
    expect(lockText(lock, story, en, undefined)).toBe('Requires Charisma 6');
    expect(lockText(lock, story, tr, undefined)).toBe('Karizma 6 gerekli');
    const above = {
      kind: 'requirement',
      requirement: { var: 'charisma', op: '>', value: 5 },
    } as const;
    expect(lockText(above, story, en, undefined)).toBe('Requires Charisma 6');
    const flag = {
      kind: 'requirement',
      requirement: { var: 'has_lamp', op: '==', value: true },
    } as const;
    expect(lockText(flag, story, tr, undefined)).toBe('Lamba var gerekli');
  });

  it("prefers the author's own words, then falls back plainly", () => {
    expect(lockText({ kind: 'text' }, story, en, 'The door is barred.')).toBe(
      'The door is barred.',
    );
    expect(lockText({ kind: 'unknown' }, story, tr, undefined)).toBe('Şimdilik seçilemez');
    expect(lockText({ kind: 'cost' }, story, en, undefined, 'gold')).toBe('Not enough Gold');
  });

  it('formats odds, costs and checks per language', () => {
    expect(oddsText(0.55, 'en')).toBe('55%');
    expect(oddsText(0.55, 'tr')).toBe('%55');
    expect(oddsText(0.001, 'en')).toBe('1%');
    expect(oddsText(0.999, 'en')).toBe('99%');
    expect(oddsText(1, 'en')).toBe('100%');
    expect(costText({ var: 'gold', amount: 10 }, story, tr)).toBe('−10 Altın');
    const beat = {
      kind: 'check',
      blockId: 'x',
      rolls: [9],
      modifier: 3,
      target: 12,
      success: true,
      values: {},
    } as const;
    expect(checkText(beat, 'Agility', en)).toBe('Agility roll: 12, needed 12 · Success');
    expect(checkText({ ...beat, success: false }, undefined, tr)).toBe(
      'Zar: 12, 12 gerekiyordu · Başarısız',
    );
  });

  it('lists every ending once', () => {
    expect(endingIds(story).sort()).toEqual([
      'dark',
      'duelist',
      'family',
      'frozen',
      'scar',
      'victory',
      'words',
    ]);
  });
});
