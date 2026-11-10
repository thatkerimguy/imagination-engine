import { describe, expect, it } from 'vitest';
import type { Value } from '@ie/core';
import {
  evaluate,
  FormulaError,
  parseFormula,
  references,
  simpleRequirement,
  type EvalContext,
} from './formula.ts';

const ctx = (vars: Record<string, Value>): EvalContext => ({
  value: (id) => vars[id] ?? null,
  visits: (id) => (id === 'alley' ? 2 : 0),
  chosen: (id) => (id === 'run' ? 1 : 0),
  random: (min) => min,
});

const run = (source: string, vars: Record<string, Value> = {}) =>
  evaluate(parseFormula(source), ctx(vars));

describe('formulas', () => {
  it('follows operator precedence', () => {
    expect(run('1 + 2 * 3')).toBe(7);
    expect(run('(1 + 2) * 3')).toBe(9);
    expect(run('10 - 2 - 3')).toBe(5);
    expect(run('-gold + 5', { gold: 2 })).toBe(3);
    expect(run('7 % 3')).toBe(1);
    expect(run('1 / 0')).toBe(0);
  });

  it('compares and combines conditions', () => {
    expect(run('charisma >= 6 and not warned', { charisma: 6, warned: false })).toBe(true);
    expect(run('charisma >= 6 && !warned', { charisma: 5, warned: false })).toBe(false);
    expect(run('mood == "angry" or hp < 3', { mood: 'calm', hp: 2 })).toBe(true);
    expect(run("name != ''", { name: 'Kerim' })).toBe(true);
  });

  it('calls functions', () => {
    expect(run('clamp(hp + 50, 0, 100)', { hp: 80 })).toBe(100);
    expect(run('max(1, 5, 3)')).toBe(5);
    expect(run('round(2.5) + floor(2.9) + ceil(0.1)')).toBe(6);
    expect(run('visited("alley") > 1')).toBe(true);
    expect(run('chosen("run")')).toBe(1);
    expect(run('has(bag, "key")', { bag: ['rope', 'key'] })).toBe(true);
    expect(run('len(bag)', { bag: ['rope'] })).toBe(1);
    expect(run('random(3, 6)')).toBe(3);
  });

  it('joins text with +', () => {
    expect(run('"Hi " + name', { name: 'Ayşe' })).toBe('Hi Ayşe');
  });

  it('explains mistakes in plain language', () => {
    const message = (source: string) => {
      try {
        parseFormula(source);
        return '';
      } catch (error) {
        return error instanceof FormulaError ? error.message : String(error);
      }
    };
    expect(message('gold >=')).toBe('The formula ends too early.');
    expect(message('(gold + 1')).toBe('A "(" is missing its closing ")".');
    expect(message('sqrt(4)')).toBe('There is no function called "sqrt".');
    expect(message('clamp(1, 2)')).toBe('"clamp" takes 3 values, not 2.');
    expect(message('gold $ 2')).toBe('"$" can\'t be used in a formula.');
    expect(message('"open')).toBe('This text is missing its closing quote.');
    expect(message('gold 2')).toBe('There is something extra at the end of the formula.');
  });

  it('lists what a formula refers to', () => {
    const refs = references(parseFormula('gold > 2 and visited("alley") and chosen("run")'));
    expect([...refs.vars]).toEqual(['gold']);
    expect([...refs.passages]).toEqual(['alley']);
    expect([...refs.options]).toEqual(['run']);
  });

  it('recognises simple requirements the reader can explain', () => {
    expect(simpleRequirement(parseFormula('charisma >= 6'))).toEqual({
      var: 'charisma',
      op: '>=',
      value: 6,
    });
    expect(simpleRequirement(parseFormula('has_key'))).toEqual({
      var: 'has_key',
      op: '==',
      value: true,
    });
    expect(simpleRequirement(parseFormula('a > 1 and b > 2'))).toBeNull();
  });
});
