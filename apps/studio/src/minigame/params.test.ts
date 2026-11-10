import { defaultGame, MINIGAME_TEMPLATES, minigameGameSchema, type MinigameGame } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { formatParam, PARAM_FIELDS, paramValue, snap, withParam } from './params.ts';

describe('minigame parameter fields', () => {
  it('only ever save values the schema accepts, at either end of every range', () => {
    for (const template of MINIGAME_TEMPLATES) {
      for (const field of PARAM_FIELDS[template]) {
        for (const value of field.choices ?? [field.min, field.max]) {
          const game = withParam(defaultGame(template), field.key, snap(value, field));
          expect(minigameGameSchema.safeParse(game).success, `${template}.${field.key}`).toBe(true);
        }
      }
    }
  });

  it('read the default when the block leaves a parameter out', () => {
    const [pins] = PARAM_FIELDS.lockpick;
    if (!pins) throw new Error('no field');
    expect(paramValue({ template: 'lockpick' }, pins)).toBe(3);
    expect(paramValue({ template: 'lockpick', pins: 6 }, pins)).toBe(6);
    const seconds = PARAM_FIELDS.slider.find((f) => f.key === 'seconds');
    if (!seconds) throw new Error('no field');
    expect(paramValue({ template: 'slider' }, seconds)).toBeUndefined();
  });

  it('remove a parameter, snap onto the step and format for the screen', () => {
    const game: MinigameGame = { template: 'slider', seconds: 60 };
    expect(withParam(game, 'seconds', undefined)).toEqual({ template: 'slider' });
    const zone = PARAM_FIELDS.tension.find((f) => f.key === 'zone');
    const speed = PARAM_FIELDS.lockpick.find((f) => f.key === 'speed');
    if (!zone || !speed) throw new Error('no field');
    expect(snap(0.30000000000000004, zone)).toBe(0.3);
    expect(snap(99, speed)).toBe(3);
    expect(formatParam(0.25, zone, 'en')).toBe('25%');
    expect(formatParam(1.5, speed, 'tr')).toBe('1,5');
  });
});
