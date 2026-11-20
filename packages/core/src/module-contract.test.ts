import { describe, expect, it } from 'vitest';
import {
  defineModuleSchema,
  fillDefaults,
  isFieldVisible,
  validateField,
} from './module-contract.ts';

interface Props {
  mode: string;
  count: number;
  numbers: number[];
  label: string;
  loud: boolean;
}

const schema = defineModuleSchema<Props>({
  meta: {
    id: 'test-mod',
    version: 1,
    name: 'Test',
    genre: 'core',
    icon: '🧪',
    layer: 'inline',
    description: 'A test module.',
  },
  fields: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    },
    { key: 'count', label: 'Count', type: 'number', min: 1, max: 3, step: 1 },
    {
      key: 'numbers',
      label: 'Numbers',
      type: 'number-list',
      min: 1,
      max: 6,
      step: 1,
      maxItems: 3,
      showWhen: { field: 'mode', equals: 'b' },
    },
    { key: 'label', label: 'Label', type: 'text', maxLength: 5 },
    { key: 'loud', label: 'Loud', type: 'toggle' },
  ],
  defaults: { mode: 'a', count: 2, numbers: [1, 1], label: 'hi', loud: false },
  refine: (p) => (p.mode === 'b' && p.numbers.length !== p.count ? ['numbers: one per die'] : []),
});

describe('defineModuleSchema', () => {
  it('fills defaults for missing props', () => {
    const r = schema.validate({ count: 3 });
    expect(r).toEqual({
      ok: true,
      props: { mode: 'a', count: 3, numbers: [1, 1], label: 'hi', loud: false },
    });
  });

  it('drops unknown keys', () => {
    expect(fillDefaults({ a: 1 }, { a: 2, b: 3 })).toEqual({ a: 2 });
  });

  it('rejects out-of-range, off-step and wrong-typed values', () => {
    expect(schema.validate({ count: 4 }).ok).toBe(false);
    expect(schema.validate({ count: 1.5 }).ok).toBe(false);
    expect(schema.validate({ loud: 'yes' }).ok).toBe(false);
    expect(schema.validate({ mode: 'c' }).ok).toBe(false);
    expect(schema.validate({ label: 'too long' }).ok).toBe(false);
    expect(schema.validate({ numbers: [7] }).ok).toBe(false);
    expect(schema.validate(null).ok).toBe(false);
  });

  it('runs the module refinement after field checks', () => {
    expect(schema.validate({ mode: 'b', count: 3 })).toEqual({
      ok: false,
      errors: ['numbers: one per die'],
    });
  });
});

describe('fields', () => {
  it('evaluates showWhen as simple equality', () => {
    const field = schema.fields[2]!;
    expect(isFieldVisible(field, { mode: 'a' })).toBe(false);
    expect(isFieldVisible(field, { mode: 'b' })).toBe(true);
  });

  it('validates colors, lists and multi-selects', () => {
    expect(validateField({ key: 'c', label: 'C', type: 'color' }, '#aabbcc')).toEqual([]);
    expect(validateField({ key: 'c', label: 'C', type: 'color' }, 'red')).toHaveLength(1);
    const list = { key: 'l', label: 'L', type: 'string-list', minItems: 1 } as const;
    expect(validateField(list, [])).toHaveLength(1);
    expect(validateField(list, ['a'])).toEqual([]);
    const multi = {
      key: 'm',
      label: 'M',
      type: 'multi-select',
      options: [{ value: 'x', label: 'X' }],
    } as const;
    expect(validateField(multi, ['x'])).toEqual([]);
    expect(validateField(multi, ['y'])).toHaveLength(1);
  });
});
