// First-tap audio unlock: the "Start chapter" tap doubles as the gesture browsers require.
import { h } from './dom.ts';
import { getPrefs, setPrefs } from './prefs.ts';

/** `onChoose` runs synchronously inside the tap handler, where audio may be unlocked. */
export function showCurtain(
  parent: HTMLElement,
  title: string,
  subtitle: string,
  onChoose: (sound: boolean) => void,
): Promise<void> {
  return new Promise((resolve) => {
    const preferSound = getPrefs().sound;
    const choose = (sound: boolean) => (): void => {
      onChoose(sound);
      setPrefs({ sound });
      curtain.classList.add('is-leaving');
      setTimeout(() => curtain.remove(), 260);
      resolve();
    };
    const on = h(
      'button',
      {
        type: 'button',
        class: `kn-curtain-btn${preferSound ? ' is-preferred' : ''}`,
        onClick: choose(true),
      },
      'Start chapter · Sound on',
    );
    const off = h(
      'button',
      {
        type: 'button',
        class: `kn-curtain-btn${preferSound ? '' : ' is-preferred'}`,
        onClick: choose(false),
      },
      'Silent',
    );
    const curtain = h(
      'div',
      {
        class: 'kn-curtain',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'kn-curtain-title',
      },
      h('p', { class: 'kn-curtain-sub' }, subtitle),
      h('h1', { id: 'kn-curtain-title', class: 'kn-curtain-title' }, title),
      h('div', { class: 'kn-curtain-actions' }, on, off),
      h('p', { class: 'kn-curtain-hint' }, 'Best with headphones.'),
    );
    parent.append(curtain);
    (preferSound ? on : off).focus();
  });
}
