import { describe, expect, it } from 'vitest';
import { timerFor } from './choices.ts';
import type { ChoiceBlock } from './schema.ts';
import type { OptionView } from './state.ts';

const choice = (timerDefault?: string): ChoiceBlock => ({
  id: 'c',
  type: 'choice',
  options: [],
  timer: timerDefault === undefined ? { seconds: 4 } : { seconds: 4, default: timerDefault },
});

const views: OptionView[] = [
  { id: 'a', enabled: false, seen: false, lock: { kind: 'cost' } },
  { id: 'b', enabled: true, seen: false },
  { id: 'c', enabled: true, seen: false },
];

describe('timerFor', () => {
  it('uses the default option when it can be chosen', () => {
    expect(timerFor(choice('c'), views)).toEqual({ seconds: 4, defaultOption: 'c' });
  });

  it('falls back to the first enabled option when the default is locked or missing', () => {
    expect(timerFor(choice('a'), views)).toEqual({ seconds: 4, defaultOption: 'b' });
    expect(timerFor(choice(), views)).toEqual({ seconds: 4, defaultOption: 'b' });
  });

  it('has no timer when nothing can be chosen', () => {
    expect(timerFor(choice('a'), [views[0] as OptionView])).toBeUndefined();
  });
});
