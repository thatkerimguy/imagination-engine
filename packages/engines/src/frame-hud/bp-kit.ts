// Tiny builders shared by the batch-A blueprint files.
import type { BlueprintFieldSpec } from '@kn/core/gimmicks';

export const opts = (...values: string[]): { value: string; label: string }[] =>
  values.map((value) => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }));
export const text = (key: string, label: string, optional = false): BlueprintFieldSpec => ({
  key,
  label,
  type: 'text',
  ...(optional ? { optional: true } : {}),
});
export const multi = (key: string, label: string): BlueprintFieldSpec => ({
  key,
  label,
  type: 'multiline',
});
export const list = (key: string, label: string, itemLabel: string): BlueprintFieldSpec => ({
  key,
  label,
  type: 'list',
  itemLabel,
  minItems: 1,
  maxItems: 12,
});
export const sound: BlueprintFieldSpec = {
  key: 'sound',
  label: 'Play sound',
  type: 'boolean',
  optional: true,
};

export const base = { version: 1, tier: 'free' as const };
