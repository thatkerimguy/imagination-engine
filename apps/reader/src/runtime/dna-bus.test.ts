// @vitest-environment happy-dom
import { DNA_ARCHETYPES, resolveVisualDna } from '@kn/core/dna';
import { describe, expect, it } from 'vitest';
import { createEngineRuntimeContext } from '../runtime-context.ts';
import { dispatchDnaChange } from './dna-bus.ts';

const dark = resolveVisualDna(DNA_ARCHETYPES['noir-rain'], 'dark');
const light = resolveVisualDna(DNA_ARCHETYPES['noir-rain'], 'light');

describe('ctx.onDnaChange', () => {
  it('keeps ctx.dna live and notifies only contexts following the changed root', () => {
    const root = document.createElement('main');
    const other = document.createElement('main');
    const a = createEngineRuntimeContext({
      tier: 'high',
      calm: false,
      dna: dark,
      dnaRoot: root,
      audio: null,
    });
    const b = createEngineRuntimeContext({
      tier: 'high',
      calm: false,
      dna: dark,
      dnaRoot: other,
      audio: null,
    });
    const seen: string[] = [];
    a.ctx.onDnaChange((d) => seen.push(d.theme));
    b.ctx.onDnaChange(() => seen.push('wrong-root'));
    dispatchDnaChange(root, light);
    expect(seen).toEqual(['light']);
    expect(a.ctx.dna.theme).toBe('light');
    expect(b.ctx.dna.theme).toBe('dark');
    a.dispose();
    dispatchDnaChange(root, dark);
    expect(seen).toEqual(['light']);
    b.dispose();
  });
});
