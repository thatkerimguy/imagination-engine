import { describe, expect, it } from 'vitest';
import {
  formulaLiteral,
  literalFormula,
  parseCondition,
  printCondition,
  type Condition,
} from './condition.ts';

const trip = (formula: string) => {
  const condition = parseCondition(formula);
  expect(condition).not.toBeNull();
  return printCondition(condition as Condition);
};

describe('condition builder model', () => {
  it('reads simple comparisons, flags and lists as rows', () => {
    expect(parseCondition('charisma >= 6 and not warned and has(items, "key")')).toEqual({
      join: 'and',
      rows: [
        { kind: 'compare', var: 'charisma', op: '>=', value: { k: 'lit', v: 6 } },
        { kind: 'flag', var: 'warned', is: false },
        { kind: 'contains', var: 'items', value: 'key', is: true },
      ],
    });
    expect(parseCondition('visited("alley") > 0 or chosen("o1") == 0')).toEqual({
      join: 'or',
      rows: [
        { kind: 'visited', passage: 'alley', is: true },
        { kind: 'chosen', option: 'o1', is: false },
      ],
    });
  });

  it('treats an empty or true condition as always', () => {
    expect(parseCondition(undefined)).toEqual({ join: 'and', rows: [] });
    expect(parseCondition(true)).toEqual({ join: 'and', rows: [] });
    expect(printCondition({ join: 'and', rows: [] })).toBe(true);
  });

  it('leaves formulas it cannot show as rows to formula mode', () => {
    expect(parseCondition('a and b or c')).toBeNull();
    expect(parseCondition('gold + 5 > hp')).toBeNull();
    expect(parseCondition('min(a, b) > 1')).toBeNull();
    expect(parseCondition('broken ((')).toBeNull();
  });

  it('prints rows back to the same formula', () => {
    expect(trip('charisma >= 6 and not warned')).toBe('charisma >= 6 and not warned');
    expect(trip('mood == "angry" or gold < max_gold')).toBe('mood == "angry" or gold < max_gold');
    expect(trip('not has(items, "key")')).toBe('not has(items, "key")');
    expect(trip('visited("alley")')).toBe('visited("alley") > 0');
  });

  it('stores plain values as literals', () => {
    expect(literalFormula(5)).toBe(5);
    expect(literalFormula(true)).toBe(true);
    expect(literalFormula('Ayşe')).toBe('"Ayşe"');
    expect(formulaLiteral('"Ayşe"')).toBe('Ayşe');
    expect(formulaLiteral('-3')).toBe(-3);
    expect(formulaLiteral(7)).toBe(7);
    expect(formulaLiteral('gold + 1')).toBeUndefined();
  });
});
