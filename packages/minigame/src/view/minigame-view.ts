import { createTranslator, type Locale } from '@ie/i18n';
import type { MinigameGame, MinigameResult, MinigameTemplate } from '@ie/story';
import { startMinigame } from '../games/index.ts';
import type { Direction, MinigameInput, MinigameSession } from '../types.ts';
import { diceView, memoryView, sliderView } from './board-views.ts';
import { builtView } from './built-view.ts';
import { el, type MountedView, type TemplateView, type ViewContext } from './dom.ts';
import { minigameMessages } from './messages.ts';
import { lockpickView, qteView, tensionView } from './timing-views.ts';
import { cipherView, typingView } from './word-views.ts';

// Each view takes its own template's state; the table is looked up by the session's template.
const VIEWS = {
  lockpick: lockpickView,
  memory: memoryView,
  cipher: cipherView,
  typing: typingView,
  qte: qteView,
  dice: diceView,
  slider: sliderView,
  tension: tensionView,
  built: builtView,
} as unknown as Readonly<Record<MinigameTemplate, TemplateView<unknown>>>;

/** Keys by physical position, so Turkish Q and F layouts play the same (ADR 0021). */
const DIR_KEYS: Readonly<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowRight: 'right',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  KeyW: 'up',
  KeyD: 'right',
  KeyS: 'down',
  KeyA: 'left',
};
const PRESS_KEYS = new Set(['Space', 'Enter', 'NumpadEnter']);
/** Templates where letters are an answer, so WASD must not act as arrows. */
const LETTER_GAMES = new Set<MinigameTemplate>(['cipher', 'typing']);
/** The longest step a frame may take, so a tab left in the background doesn't skip the game. */
const MAX_STEP = 0.05;
/** How long the finished game stays in view before the result covers it. */
const RESULT_DELAY_MS = 450;

export interface MinigameViewOptions {
  /** Where the screen goes; it covers the viewport, or `host` when `contained`. */
  readonly host: HTMLElement;
  readonly contained?: boolean;
  readonly game: MinigameGame;
  /** The block's own title in the reader's language, if it has one. */
  readonly title?: string;
  readonly seed: number;
  readonly locale: Locale;
  readonly relaxed?: boolean;
  readonly haptics?: boolean;
  readonly onDone: (result: MinigameResult) => void;
}

/**
 * A minigame on screen (ADR 0021): the title, a help line, the template's own view, a clock bar
 * and the result. One animation-frame loop updates the game and redraws; nothing here uses the
 * GPU stage. Calls `onDone` once the reader closes the result.
 */
export class MinigameView {
  readonly root: HTMLElement;
  readonly session: MinigameSession;
  private readonly view: MountedView;
  private readonly clock: HTMLElement;
  private readonly clockFill: HTMLElement;
  private readonly status: HTMLElement;
  private readonly resultBox: HTMLElement;
  private readonly t;
  private frame = 0;
  private last = 0;
  private timer = 0;
  private finished = false;
  private closed = false;
  private clockShare = -1;

  constructor(private readonly options: MinigameViewOptions) {
    const { game, locale } = options;
    const t = createTranslator(minigameMessages, locale);
    this.t = t;
    this.session = startMinigame(game, {
      seed: options.seed,
      locale,
      ...(options.relaxed ? { relaxed: true } : {}),
    });

    const root = el('section', 'ie-mini');
    this.root = root;
    if (options.contained) root.classList.add('ie-mini--contained');
    root.dataset.testid = 'minigame';
    root.dataset.template = game.template;
    root.setAttribute('role', 'group');
    const name = t(`mini.name.${game.template}`);
    root.setAttribute('aria-label', options.title || name);

    const top = el('header', 'ie-mini__top', root);
    el('p', 'ie-mini__label', top).textContent = options.title ? name : t('mini.label');
    el('h2', 'ie-mini__title', top).textContent = options.title || name;
    el('p', 'ie-mini__help', top).textContent = t(`mini.help.${game.template}`);
    this.clock = el('div', 'ie-mini__clock', top);
    this.clock.setAttribute('role', 'timer');
    this.clock.setAttribute('aria-label', t('mini.timeLeft'));
    this.clock.hidden = true;
    this.clockFill = el('span', 'ie-mini__clock-fill', this.clock);
    this.status = el('p', 'ie-mini__status', top);
    this.status.setAttribute('aria-live', 'polite');
    this.status.dataset.testid = 'minigame-status';

    const field = el('div', 'ie-mini__field', root);
    field.dataset.template = game.template;
    const ctx: ViewContext = {
      t,
      locale,
      emit: (input) => this.emit(input),
      status: (text) => {
        this.status.textContent = text;
      },
    };
    this.view = VIEWS[game.template](field, this.session.state, ctx);

    this.resultBox = el('div', 'ie-mini__result', root);
    this.resultBox.hidden = true;
    this.resultBox.dataset.testid = 'minigame-result';

    options.host.append(root);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.draw();
    this.view.focus?.();
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.loop);
  }

  /** Leaves the game at once, without a result (a rewind, closing the novel, leaving Play). */
  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.timer);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.view.dispose?.();
    this.root.remove();
  }

  private readonly loop = (now: number) => {
    if (this.closed || this.finished) return;
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(MAX_STEP, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.session.update(dt);
    this.draw();
    this.check();
  };

  private emit(input: MinigameInput): void {
    if (this.closed || this.finished) return;
    this.session.input(input);
    if (this.options.haptics && input.kind !== 'release' && input.kind !== 'text')
      navigator.vibrate?.(12);
    // Draw at once: a tap should show before the next frame, and the game may have just ended.
    this.draw();
    this.check();
  }

  private draw(): void {
    this.view.draw();
    const left = this.session.timeLeft();
    if (left === null) {
      if (!this.clock.hidden) this.clock.hidden = true;
      return;
    }
    if (this.clock.hidden) this.clock.hidden = false;
    // A thousandth of the bar is under a pixel: skip the write when the bar wouldn't move.
    const share = Math.round(left * 1000);
    if (share === this.clockShare) return;
    this.clockShare = share;
    this.clockFill.style.transform = `scaleX(${share / 1000})`;
  }

  private check(): void {
    const result = this.session.result();
    if (!result || this.finished) return;
    this.finished = true;
    cancelAnimationFrame(this.frame);
    this.root.dataset.over = result.won ? 'won' : 'lost';
    this.timer = window.setTimeout(() => this.showResult(result), RESULT_DELAY_MS);
  }

  private showResult(result: MinigameResult): void {
    if (this.closed) return;
    const box = this.resultBox;
    box.dataset.result = result.won ? 'won' : 'lost';
    el('h2', 'ie-mini__result-title', box).textContent = this.t(
      result.won ? 'mini.won' : 'mini.lost',
    );
    el('p', 'ie-mini__result-score', box).textContent = this.t('mini.score', { n: result.score });
    const go = el('button', 'ie-button ie-button--primary', box);
    go.type = 'button';
    go.textContent = this.t('mini.continue');
    go.dataset.testid = 'minigame-continue';
    go.addEventListener('click', () => {
      this.dispose();
      this.options.onDone(result);
    });
    box.hidden = false;
    go.focus({ preventScroll: true });
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (this.finished || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target : null;
    const typing = target?.closest('input, textarea') !== null && target !== null;
    const template = this.session.template;
    if (typing) return;
    if (PRESS_KEYS.has(event.code)) {
      // A focused pad or tile is pressed by its own click; anything else is the main action.
      if (target?.closest('button') && !target.closest('[data-primary]')) return;
      event.preventDefault();
      if (!event.repeat) this.emit({ kind: 'press' });
      return;
    }
    if (event.code === 'Backspace') {
      event.preventDefault();
      this.emit({ kind: 'back' });
      return;
    }
    const dir = DIR_KEYS[event.code];
    if (dir && !(LETTER_GAMES.has(template) && event.code.startsWith('Key'))) {
      event.preventDefault();
      if (!event.repeat) this.emit({ kind: 'dir', dir });
      return;
    }
    const digit = /^(?:Digit|Numpad)([1-9])$/.exec(event.code);
    if (digit && !LETTER_GAMES.has(template)) {
      event.preventDefault();
      this.emit({ kind: 'pick', index: Number(digit[1]) - 1 });
      return;
    }
    if (this.view.key?.(event)) event.preventDefault();
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    if (PRESS_KEYS.has(event.code)) this.emit({ kind: 'release' });
  };
}
