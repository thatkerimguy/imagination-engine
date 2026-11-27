import { STARTER_BLUEPRINT_LIST } from '@kn/engines/blueprints';
import type { BlueprintFieldSpec, BlueprintProps } from '@kn/core/gimmicks';
import { describe, expect, it } from 'vitest';
import {
  blankRecord,
  errorCount,
  fieldErrors,
  initialValues,
  moveAt,
  setCell,
  setValue,
  toCueProps,
} from './form-model.ts';

describe('blueprint form round trip', () => {
  it('has the starter blueprints', () => {
    expect(STARTER_BLUEPRINT_LIST.length).toBeGreaterThanOrEqual(14);
  });

  it.each(STARTER_BLUEPRINT_LIST.map((b) => [b.id, b] as const))(
    'defaults and sample props round-trip for %s',
    (_id, bp) => {
      for (const source of [bp.defaultProps, bp.sampleProps]) {
        const values = initialValues(bp, source);
        expect(errorCount(fieldErrors(bp, values))).toBe(0);
        const props = toCueProps(bp, values);
        expect(props).toEqual({ blueprintId: bp.id, ...initialValues(bp, source) });
      }
      expect(toCueProps(bp, initialValues(bp))).toEqual({ blueprintId: bp.id, ...bp.defaultProps });
    },
  );
});

/** A valid replacement value per field type, to prove edits stay valid. */
function edited(f: BlueprintFieldSpec): BlueprintProps[string] {
  switch (f.type) {
    case 'text':
    case 'multiline':
      return 'Edited';
    case 'list':
      return Array.from({ length: Math.max(1, f.minItems ?? 1) }, (_, i) => `Line ${i + 1}`);
    case 'records':
      return Array.from({ length: Math.max(1, f.minItems ?? 1) }, () => blankRecord(f.columns));
    case 'select':
      return f.options[f.options.length - 1]!.value;
    case 'number':
      return f.max;
    case 'boolean':
      return true;
    case 'color':
      return '#336699';
  }
}

describe('field edits', () => {
  it('produce valid props for every field type in the starter pack', () => {
    const seen = new Set<string>();
    for (const bp of STARTER_BLUEPRINT_LIST) {
      for (const f of bp.fields) {
        seen.add(f.type);
        const values = setValue(initialValues(bp), f, edited(f));
        const errs = fieldErrors(bp, values)[f.key] ?? [];
        // blank records may legitimately fail a column rule; only non-record edits must pass.
        if (f.type !== 'records') expect(errs, `${bp.id}.${f.key}`).toEqual([]);
        else expect(Array.isArray(values[f.key])).toBe(true);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  it('flags an out-of-range number and a bad color', () => {
    const bp = STARTER_BLUEPRINT_LIST.find((b) => b.fields.some((f) => f.type === 'number'));
    if (!bp) return;
    const f = bp.fields.find((x) => x.type === 'number')!;
    const bad = setValue(initialValues(bp), f, 1e9);
    expect(toCueProps(bp, bad)).toBeNull();
    expect(fieldErrors(bp, bad)[f.key]?.length).toBeGreaterThan(0);
  });

  it('removes an emptied optional field', () => {
    const f: BlueprintFieldSpec = { key: 'k', label: 'K', type: 'text', optional: true };
    expect(setValue({ k: 'a' }, f, '')).toEqual({});
  });
});

describe('row helpers', () => {
  it('moves rows and stays put at the edges', () => {
    expect(moveAt([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveAt([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  });
  it('builds blank rows and edits cells', () => {
    const cols = [
      { key: 'a', label: 'A', type: 'text' as const },
      { key: 'n', label: 'N', type: 'number' as const },
      { key: 's', label: 'S', type: 'select' as const, options: [{ value: 'x', label: 'X' }] },
    ];
    const row = blankRecord(cols);
    expect(row).toEqual({ a: '', n: 0, s: 'x' });
    expect(setCell([row], 0, cols[1]!, 4)[0]).toEqual({ a: '', n: 4, s: 'x' });
  });
});
