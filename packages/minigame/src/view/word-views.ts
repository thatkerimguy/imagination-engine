import { upper } from '@ie/i18n';
import type { CipherState } from '../games/cipher.ts';
import type { TypingState } from '../games/typing.ts';
import { el, Painter, pressButton, type TemplateView } from './dom.ts';

/* The two games played with letters: the cipher and the typing duel. */

export const cipherView: TemplateView<CipherState> = (field, s, ctx) => {
  const paint = new Painter();
  const answer = el('div', 'ie-mini__slots', field);
  answer.setAttribute('aria-label', ctx.t('mini.cipher.answer'));
  answer.dataset.testid = 'minigame-answer';
  const tiles = el('div', 'ie-mini__letters', field);
  const undo = pressButton('ie-button ie-button--quiet', field, () => ctx.emit({ kind: 'back' }));
  undo.textContent = ctx.t('mini.cipher.undo');
  let slots: HTMLElement[] = [];
  let buttons: HTMLButtonElement[] = [];

  const build = () => {
    const word = s.words[s.index] ?? [];
    answer.replaceChildren();
    tiles.replaceChildren();
    slots = word.map(() => el('span', 'ie-mini__slot', answer));
    buttons = s.tiles.map((letter, index) => {
      const button = pressButton('ie-mini__letter', tiles, () => ctx.emit({ kind: 'pick', index }));
      button.textContent = letter;
      button.dataset.testid = `minigame-letter-${index}`;
      return button;
    });
  };

  return {
    draw() {
      paint.when('word', `${s.index}:${s.tiles.join('')}`, build);
      paint.when('picked', `${s.index}:${s.picked.join(',')}`, () => {
        slots.forEach((slot, i) => {
          const tile = s.picked[i];
          slot.textContent = tile === undefined ? '' : (s.tiles[tile] ?? '');
        });
        buttons.forEach((button, i) => {
          button.dataset.used = String(s.picked.includes(i));
        });
      });
      paint.data('wrong', answer, 'wrong', String(s.wrong));
      paint.when('status', String(s.index), () =>
        ctx.status(
          ctx.t('mini.cipher.status', {
            n: Math.min(s.index + 1, s.words.length),
            total: s.words.length,
          }),
        ),
      );
    },
    key(event) {
      if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return false;
      // The typed letter in this language's capitals: "i" is İ in Turkish and I in English.
      const letter = upper(event.key, ctx.locale);
      const index = s.tiles.findIndex((tile, i) => tile === letter && !s.picked.includes(i));
      if (index < 0) return false;
      ctx.emit({ kind: 'pick', index });
      return true;
    },
  };
};

export const typingView: TemplateView<TypingState> = (field, s, ctx) => {
  const paint = new Painter();
  const phrase = el('p', 'ie-mini__phrase', field);
  phrase.dataset.testid = 'minigame-phrase';
  const typed = el('span', 'ie-mini__typed', phrase);
  const rest = el('span', 'ie-mini__rest', phrase);
  const input = el('input', 'ie-mini__input', field);
  input.type = 'text';
  input.autocomplete = 'off';
  input.autocapitalize = 'none';
  input.spellcheck = false;
  input.enterKeyHint = 'done';
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('aria-label', ctx.t('mini.typing.field'));
  input.dataset.testid = 'minigame-input';
  /** What the field held after the last accepted letter. */
  let accepted = '';

  input.addEventListener('input', () => {
    const before = s.mistakes;
    const index = s.index;
    ctx.emit({ kind: 'text', text: input.value });
    if (s.index !== index) {
      accepted = '';
      input.value = '';
      // A wrong letter is taken back out; a right one is left alone, so the phone's own
      // word-in-progress isn't interrupted while it is still being composed.
    } else if (s.mistakes !== before) input.value = accepted;
    else accepted = input.value;
  });

  return {
    draw() {
      const target = s.phrases[Math.min(s.index, s.phrases.length - 1)] ?? '';
      const done = s.index >= s.phrases.length ? target.length : s.typed.length;
      paint.text('typed', typed, target.slice(0, done));
      paint.text('rest', rest, target.slice(done));
      paint.data('mistakes', phrase, 'mistakes', String(s.mistakes));
      paint.when('status', `${s.index}:${s.mistakes}`, () =>
        ctx.status(
          ctx.t('mini.typing.status', {
            n: Math.min(s.index + 1, s.phrases.length),
            total: s.phrases.length,
            mistakes: s.mistakes,
          }),
        ),
      );
    },
    focus() {
      input.focus({ preventScroll: true });
    },
  };
};
