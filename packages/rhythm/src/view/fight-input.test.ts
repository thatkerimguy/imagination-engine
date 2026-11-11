import { afterEach, describe, expect, it } from 'vitest';
import { FightInput, type FightAction } from './fight-input.ts';

/** Node has no DOM: an EventTarget stands in for the window and the fight's element. */
function setup() {
  const win = new EventTarget();
  (globalThis as { window?: unknown }).window = win;
  const actions: FightAction['action'][] = [];
  const input = new FightInput({
    target: new EventTarget() as unknown as HTMLElement,
    onAction: (a) => actions.push(a.action),
    expectsSwipe: () => false,
  });
  const press = (code: string, extra: Record<string, unknown> = {}) =>
    win.dispatchEvent(Object.assign(new Event('keydown'), { code, repeat: false, ...extra }));
  return { input, actions, press };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe('fight keys', () => {
  it('tap with Z and X as well as F, J and Space; swipe with D, K and arrows', () => {
    const { input, actions, press } = setup();
    for (const code of ['KeyZ', 'KeyX', 'KeyF', 'Space', 'KeyD', 'ArrowLeft']) press(code);
    expect(actions).toEqual(['tap', 'tap', 'tap', 'tap', 'swipe', 'swipe']);
    input.dispose();
  });

  it('ignores held keys, shortcuts and other letters', () => {
    const { input, actions, press } = setup();
    press('KeyZ', { repeat: true });
    press('KeyZ', { ctrlKey: true });
    press('KeyQ');
    expect(actions).toEqual([]);
    input.dispose();
  });
});
