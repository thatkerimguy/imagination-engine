import { describe, expect, it } from 'vitest';
import { parseFormula } from './formula.ts';
import { printFormula } from './formula-print.ts';

const roundTrip = (source: string) => printFormula(parseFormula(source));

describe('printFormula', () => {
  it('prints what it parsed, normalised', () => {
    expect(roundTrip('charisma>=6')).toBe('charisma >= 6');
    expect(roundTrip('a && !b')).toBe('a and not b');
    expect(roundTrip('visited("alley") > 1')).toBe('visited("alley") > 1');
    expect(roundTrip('name == \'say "hi"\'')).toBe(`name == 'say "hi"'`);
    expect(roundTrip('clamp(hp + 5, 0, max_hp)')).toBe('clamp(hp + 5, 0, max_hp)');
  });

  it('keeps only the parentheses that change the meaning', () => {
    expect(roundTrip('(a + b) * c')).toBe('(a + b) * c');
    expect(roundTrip('a + (b * c)')).toBe('a + b * c');
    expect(roundTrip('a - (b - c)')).toBe('a - (b - c)');
    expect(roundTrip('(a - b) - c')).toBe('a - b - c');
    expect(roundTrip('(a or b) and c')).toBe('(a or b) and c');
    expect(roundTrip('not (a and b)')).toBe('not (a and b)');
    expect(roundTrip('-(x + 1)')).toBe('-(x + 1)');
  });

  it('round-trips to the same tree', () => {
    for (const source of ['a or b and c', '(a or b) and not c', 'x * (y - 2) % 3 >= z']) {
      expect(parseFormula(roundTrip(source))).toEqual(parseFormula(source));
    }
  });
});
