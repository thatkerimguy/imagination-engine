import { FONT_VOICES, TRACKINGS } from '@kn/core/dna';
import { describe, expect, it } from 'vitest';
import { chipStates } from './dna-choice.ts';

describe('chipStates', () => {
  it('marks exactly one chip active per typography group', () => {
    for (const current of FONT_VOICES) {
      const states = chipStates(FONT_VOICES, current);
      expect(states.filter((s) => s.active).map((s) => s.value)).toEqual([current]);
    }
    expect(chipStates(TRACKINGS, TRACKINGS[0]!).filter((s) => s.active)).toHaveLength(1);
  });

  it('Typewriter is inactive while Clean sans is selected', () => {
    const typewriter = chipStates(FONT_VOICES, 'sans-clean').find(
      (s) => s.value === 'mono-typewriter',
    );
    expect(typewriter?.active).toBe(false);
  });
});
