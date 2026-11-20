import { describe, expect, it } from 'vitest';
import { schema as ambient } from '@kn/module-core-ambient-bed';
import { schema as dice } from '@kn/module-bl-dice-3d';
import { schema as chat } from '@kn/module-gits-cyberbrain-chat';
import type { ModuleSchemaDefinition } from '@kn/core';
import {
  initialDraft,
  listAdd,
  listMove,
  listRemove,
  listUpdate,
  resetDraft,
  setField,
  snapNumber,
  stepNumber,
  validateDraft,
  visibleFields,
} from './form-state.ts';

type S = ModuleSchemaDefinition<Record<string, unknown>>;
const diceS = dice as unknown as S;
const ambientS = ambient as unknown as S;
const chatS = chat as unknown as S;
const keys = (s: S, d: Record<string, unknown>): string[] =>
  visibleFields(s.fields, d).map((f) => f.key);

describe('visibility', () => {
  it('shows scriptedNumbers only in scripted mode', () => {
    const d = initialDraft(diceS, {});
    expect(keys(diceS, d)).toContain('scriptedNumbers');
    expect(keys(diceS, setField(d, 'outcomeMode', 'random'))).not.toContain('scriptedNumbers');
  });

  it('handles ambient asset and preset', () => {
    const d = initialDraft(ambientS, {});
    expect(keys(ambientS, d)).not.toContain('asset');
    expect(keys(ambientS, setField(d, 'preset', 'custom'))).toContain('asset');
    expect(keys(ambientS, setField(d, 'action', 'stop'))).not.toContain('preset');
  });
});

describe('validateDraft', () => {
  it('accepts defaults', () => {
    const r = validateDraft(diceS, initialDraft(diceS, {}));
    expect(r.valid).toBe(true);
    expect(r.props).toBeDefined();
  });

  it('maps refine errors to the field and strips the prefix', () => {
    const d = setField(initialDraft(diceS, {}), 'count', 3);
    const r = validateDraft(diceS, d);
    expect(r.valid).toBe(false);
    expect(r.byField.scriptedNumbers?.[0]).toMatch(/^give exactly 3 numbers/);
    expect(r.general).toEqual([]);
  });

  it('maps empty chat lines to messages', () => {
    const d = setField(initialDraft(chatS, {}), 'messages', ['hello', '  ']);
    const r = validateDraft(chatS, d);
    expect(r.byField.messages).toEqual(['remove empty lines']);
  });
});

describe('reset', () => {
  it('returns a copy of the defaults', () => {
    const d = setField(initialDraft(diceS, {}), 'count', 3);
    const r = resetDraft(diceS);
    expect(r).toEqual(diceS.defaults);
    expect(r).not.toBe(diceS.defaults);
    expect(d.count).toBe(3);
  });
});

describe('list helpers', () => {
  it('adds honouring max', () => {
    expect(listAdd([1], 2, 2)).toEqual([1, 2]);
    expect(listAdd([1, 2], 3, 2)).toEqual([1, 2]);
  });
  it('updates, removes and moves immutably', () => {
    const a = ['a', 'b', 'c'];
    expect(listUpdate(a, 1, 'x')).toEqual(['a', 'x', 'c']);
    expect(listRemove(a, 0)).toEqual(['b', 'c']);
    expect(listRemove(['a'], 0, 1)).toEqual(['a']);
    expect(listMove(a, 0, 1)).toEqual(['b', 'a', 'c']);
    expect(listMove(a, 0, -1)).toEqual(a);
    expect(listMove(a, 2, 1)).toEqual(a);
    expect(a).toEqual(['a', 'b', 'c']);
  });
});

describe('number snapping', () => {
  it('avoids float noise on 0.1 steps', () => {
    expect(snapNumber(1.2000000000000002, 0.4, 4, 0.1)).toBe(1.2);
    expect(stepNumber(1.1, 1, 0.4, 4, 0.1)).toBe(1.2);
    expect(stepNumber(0.4, -1, 0.4, 4, 0.1)).toBe(0.4);
    expect(snapNumber(9, 0.4, 4, 0.1)).toBe(4);
  });
  it('handles 0.05 steps', () => {
    expect(snapNumber(0.33, 0, 1, 0.05)).toBe(0.35);
    expect(stepNumber(0.35, 1, 0, 1, 0.05)).toBe(0.4);
    expect(stepNumber(1, 1, 0, 1, 0.05)).toBe(1);
  });
});
