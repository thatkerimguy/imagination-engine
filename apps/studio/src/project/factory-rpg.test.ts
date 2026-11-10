import type { VariableDef } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { currencyFor, withHeroStats } from './factory-rpg.ts';
import { newProject } from './factory.ts';

const blank = () => newProject({ en: 'Test', tr: 'Deneme' });

describe('RPG defaults', () => {
  it('creates hero stats and points Hero at them', () => {
    const doc = withHeroStats(blank());
    const hp = doc.variables.find((v) => v.id === doc.hero?.hp);
    expect(hp?.type).toBe('number');
    expect(doc.hero?.attack).toBeDefined();
  });

  it('never picks a hero stat as the shop currency when another number exists', () => {
    expect(currencyFor(blank())).toBeUndefined();
    const base = withHeroStats(blank());
    // Only hero stats: the first number still works rather than leaving the shop unpaid.
    expect(currencyFor(base)).toBe(base.variables.find((v) => v.type === 'number')?.id);
    const gold: VariableDef = {
      id: 'gold',
      name: { en: 'Gold', tr: 'Altın' },
      type: 'number',
      default: 5,
    };
    expect(currencyFor({ ...base, variables: [...base.variables, gold] })).toBe('gold');
  });
});
