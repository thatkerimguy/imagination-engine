// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { btnOf, setup } from './batch-b-setup.ts';
import tactileReveal from './tactile-reveal/index.ts';

const touch = (el: HTMLElement): string => el.style.touchAction;

describe('tactile-reveal touch-action placement (04A)', () => {
  it('scratch-off: none only on the gesture button, never on the card', () => {
    const { root } = setup(tactileReveal, 'wax-seal-letter', 'high', { mechanism: 'scratch-off' });
    expect(touch(btnOf(root))).toBe('none');
    expect(touch(root)).toBe('');
    expect(touch(root.parentElement as HTMLElement)).toBe('');
    const outer = [root, ...root.querySelectorAll<HTMLElement>('*')].filter(
      (n) => n !== btnOf(root),
    );
    expect(outer.filter((n) => !btnOf(root).contains(n) && touch(n) === 'none')).toHaveLength(0);
  });

  it('biometric-hold: none on the button only', () => {
    const { root } = setup(tactileReveal, 'biometric-lock', 'high');
    expect(touch(btnOf(root))).toBe('none');
    expect(touch(root)).toBe('');
  });

  it('wax-seal has no touch lock; the stylesheet never forces it', () => {
    const { root } = setup(tactileReveal, 'wax-seal-letter', 'high');
    expect(touch(btnOf(root))).toBe('');
    const css = document.head.querySelector('style[data-kn-engine="tactile-reveal"]')!.textContent!;
    expect(css).not.toContain('touch-action:none');
  });

  it('releases the lock after reveal and in reduced tier', () => {
    const { root, t } = setup(tactileReveal, 'biometric-lock', 'high');
    t.setTier('reduced');
    expect(touch(btnOf(root))).toBe('');
    const r = setup(tactileReveal, 'wax-seal-letter', 'reduced', { mechanism: 'fog-wipe' });
    expect(touch(btnOf(r.root))).toBe('');
    const s = setup(tactileReveal, 'wax-seal-letter', 'high', { mechanism: 'fog-wipe' });
    expect(touch(btnOf(s.root))).toBe('none');
    btnOf(s.root).click();
    expect(touch(btnOf(s.root))).toBe('');
  });
});
