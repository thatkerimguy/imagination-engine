import type { Value } from '@ie/core';
import { truthy, valueText } from './formula.ts';
import type { VariableDef } from './schema.ts';

const same = (a: Value, b: Value) => JSON.stringify(a) === JSON.stringify(b);

/** The result of a Set block's operation on the current value. */
export function applyOperation(current: Value, op: string, value: Value): Value {
  const list = Array.isArray(current) ? current : [];
  switch (op) {
    case 'add':
      return (Number(current) || 0) + (Number(value) || 0);
    case 'subtract':
      return (Number(current) || 0) - (Number(value) || 0);
    case 'toggle':
      return !truthy(current);
    case 'append':
      return [...list, value];
    case 'remove':
      return list.filter((item) => !same(item, value));
    default:
      return value;
  }
}

/** Fits a value to its variable's type and limits (numbers clamp to min/max). */
export function coerceValue(def: VariableDef, raw: Value): Value {
  switch (def.type) {
    case 'number': {
      let value = Number(raw) || 0;
      if (def.min !== undefined) value = Math.max(def.min, value);
      if (def.max !== undefined) value = Math.min(def.max, value);
      return value;
    }
    case 'bool':
      return truthy(raw);
    case 'text':
    case 'enum':
      return valueText(raw);
    case 'list':
      return Array.isArray(raw) ? raw : raw === null ? [] : [raw];
  }
}
