import { describe, expect, it } from 'vitest';
import { isHexColor, parseNumberInput, rangeHint, readableOn } from './field-hints.ts';

describe('rangeHint', () => {
  it('formats ranges with and without a unit', () => {
    expect(rangeHint({ min: 1, max: 3 })).toBe('1–3');
    expect(rangeHint({ min: 0.5, max: 8, unit: 's' })).toBe('0.5–8 s');
    expect(rangeHint({ min: 0, max: 1 })).toBe('0–1');
  });
});

describe('parseNumberInput', () => {
  it('parses numbers and decimal commas', () => {
    expect(parseNumberInput('2.5')).toBe(2.5);
    expect(parseNumberInput(' 1,5 ')).toBe(1.5);
  });
  it('rejects empty and non-numeric text', () => {
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('abc')).toBeNull();
  });
});

describe('colour helpers', () => {
  it('validates hex colours', () => {
    expect(isHexColor('#a1B2c3')).toBe(true);
    expect(isHexColor('#abc')).toBe(false);
  });
  it('picks a readable check colour', () => {
    expect(readableOn('#f2d65c')).toBe('#000000');
    expect(readableOn('#003733')).toBe('#ffffff');
    expect(readableOn('nope')).toBe('#ffffff');
  });
});
