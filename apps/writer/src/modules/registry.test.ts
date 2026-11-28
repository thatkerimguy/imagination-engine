import { describe, expect, it } from 'vitest';
import {
  enabledWriterModules,
  getWriterModule,
  moduleOutlineLabel,
  writerModules,
} from './registry.ts';

describe('writer module registry (v1 retired)', () => {
  it('registers no legacy modules', () => {
    expect(writerModules).toEqual([]);
    expect(getWriterModule('bl-dice-3d')).toBeUndefined();
    expect(enabledWriterModules(['bl-dice-3d', 'core-ambient-bed'])).toEqual([]);
  });

  it('outline label falls back to the raw id for an unknown legacy block', () => {
    expect(moduleOutlineLabel('bl-dice-3d', {})).toBe('bl-dice-3d');
  });
});
