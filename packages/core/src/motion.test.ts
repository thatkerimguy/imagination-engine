import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion, setMotionPreference, watchReducedMotion } from './motion.ts';

/** Just enough of `document` and `matchMedia` for the helper. */
function fakePage(systemReduces: boolean) {
  const target = new EventTarget();
  const dataset: Record<string, string> = {};
  const doc = Object.assign(target, { documentElement: { dataset } });
  vi.stubGlobal('document', doc);
  vi.stubGlobal('matchMedia', () => Object.assign(new EventTarget(), { matches: systemReduces }));
  return doc;
}

describe('reduced motion', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is off without a page', () => {
    expect(prefersReducedMotion()).toBe(false);
  });

  it('follows the system until the reader chooses', () => {
    const doc = fakePage(true);
    expect(prefersReducedMotion()).toBe(true);
    setMotionPreference('full');
    expect(doc.documentElement.dataset.motion).toBe('full');
    expect(prefersReducedMotion()).toBe(false);
    setMotionPreference('system');
    expect(doc.documentElement.dataset.motion).toBeUndefined();
    expect(prefersReducedMotion()).toBe(true);
  });

  it('tells watchers when the reader changes it', () => {
    fakePage(false);
    const seen: boolean[] = [];
    const stop = watchReducedMotion((reduce) => seen.push(reduce));
    setMotionPreference('reduce');
    setMotionPreference('full');
    stop();
    setMotionPreference('reduce');
    expect(seen).toEqual([true, false]);
  });
});
