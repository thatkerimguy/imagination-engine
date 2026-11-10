import type { Translator } from '@ie/i18n';
import type { Grade } from '../judge.ts';
import type { Turn } from '../director.ts';
import { NOTE_GLYPHS } from './fight-layer.ts';
import type { FightKey } from './messages.ts';

export type FightText = Translator<FightKey>;

const TURN_LABEL: Readonly<Record<Turn, FightKey>> = {
  count: 'fight.ready',
  enemy: 'fight.defend',
  player: 'fight.strike',
  free: 'fight.free',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement) {
  const node = document.createElement(tag);
  node.className = className;
  parent.append(node);
  return node;
}

/**
 * The fight's DOM: enemy name and presence, HP bars, the turn cue, judgements and the result.
 * HP bars move with transforms and text changes only when it differs, so a frame costs little.
 */
export class FightHud {
  readonly root: HTMLElement;
  private readonly enemyBar: HTMLElement;
  private readonly playerBar: HTMLElement;
  private readonly cue: HTMLElement;
  private readonly judgement: HTMLElement;
  private readonly combo: HTMLElement;
  private readonly result: HTMLElement;
  readonly fallback: HTMLElement;
  private shown = { cue: '', combo: '', enemy: -1, player: -1 };

  constructor(
    host: HTMLElement,
    private readonly text: FightText,
    enemyName: string,
    presence: readonly string[],
  ) {
    const root = el('div', 'ie-fight', host);
    root.setAttribute('role', 'application');
    root.setAttribute('aria-label', `${text('fight.label')}: ${enemyName}. ${text('fight.help')}`);
    root.dataset.testid = 'fight';
    this.root = root;

    const top = el('div', 'ie-fight__top', root);
    el('div', 'ie-fight__enemy', top).textContent = enemyName;
    this.enemyBar = this.bar(top, 'ie-fight__bar ie-fight__bar--enemy', text('fight.enemyHp'));
    const words = el('div', 'ie-fight__presence', top);
    words.setAttribute('aria-hidden', 'true');
    words.textContent = presence.join(' · ');

    this.cue = el('div', 'ie-fight__cue', root);
    this.cue.setAttribute('aria-live', 'polite');
    this.cue.dataset.testid = 'fight-cue';
    this.judgement = el('div', 'ie-fight__judgement', root);
    this.judgement.setAttribute('aria-hidden', 'true');
    this.fallback = el('div', 'ie-fight__fallback', root);
    this.fallback.hidden = true;

    const bottom = el('div', 'ie-fight__bottom', root);
    // What each mark asks for, always in view: the same shapes the notes are drawn with.
    const legend = el('div', 'ie-fight__legend', bottom);
    legend.dataset.testid = 'fight-legend';
    for (const [glyphs, key, input] of [
      [`${NOTE_GLYPHS.strike} ${NOTE_GLYPHS.parry}`, 'fight.tap', 'tap'],
      [NOTE_GLYPHS.dodge, 'fight.swipe', 'swipe'],
    ] as const) {
      const item = el('span', 'ie-fight__legend-item', legend);
      item.dataset.input = input;
      const mark = el('span', 'ie-fight__legend-mark', item);
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = glyphs;
      el('span', '', item).textContent = text(key);
    }
    this.combo = el('div', 'ie-fight__combo', bottom);
    this.playerBar = this.bar(
      bottom,
      'ie-fight__bar ie-fight__bar--player',
      text('fight.playerHp'),
    );

    this.result = el('div', 'ie-fight__result', root);
    this.result.hidden = true;
    this.result.dataset.testid = 'fight-result';
  }

  setTurn(turn: Turn): void {
    const label = this.text(TURN_LABEL[turn]);
    if (label === this.shown.cue) return;
    this.shown.cue = label;
    this.cue.textContent = label;
    this.cue.dataset.turn = turn;
  }

  setHp(enemy: number, player: number): void {
    const e = Math.round(enemy * 1000) / 1000;
    const p = Math.round(player * 1000) / 1000;
    if (e !== this.shown.enemy) {
      this.shown.enemy = e;
      this.fill(this.enemyBar, e);
    }
    if (p !== this.shown.player) {
      this.shown.player = p;
      this.fill(this.playerBar, p);
    }
  }

  setCombo(combo: number): void {
    const label = combo >= 4 ? this.text('fight.combo', { n: combo }) : '';
    if (label === this.shown.combo) return;
    this.shown.combo = label;
    this.combo.textContent = label;
  }

  judge(grade: Grade): void {
    this.judgement.textContent = this.text(`fight.${grade}`);
    this.judgement.dataset.grade = grade;
    // Restart the fade: drop the class, force a style read, add it back.
    this.judgement.classList.remove('is-shown');
    void this.judgement.offsetWidth;
    this.judgement.classList.add('is-shown');
  }

  announce(label: string): void {
    this.cue.textContent = label;
    this.shown.cue = label;
  }

  showResult(won: boolean, score: number): HTMLElement {
    this.result.replaceChildren();
    el('h2', 'ie-fight__result-title', this.result).textContent = this.text(
      won ? 'fight.victory' : 'fight.defeat',
    );
    el('p', 'ie-fight__result-score', this.result).textContent = this.text('fight.score', {
      n: score,
    });
    const go = el('button', 'ie-button ie-button--primary', this.result);
    go.type = 'button';
    go.textContent = this.text('fight.continue');
    go.dataset.testid = 'fight-continue';
    this.result.hidden = false;
    this.root.classList.add('is-over');
    return go;
  }

  dispose(): void {
    this.root.remove();
  }

  private bar(parent: HTMLElement, className: string, label: string): HTMLElement {
    const bar = el('div', className, parent);
    bar.setAttribute('role', 'meter');
    bar.setAttribute('aria-label', label);
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    el('span', 'ie-fight__fill', bar);
    return bar;
  }

  private fill(bar: HTMLElement, value: number): void {
    (bar.firstElementChild as HTMLElement).style.transform = `scaleX(${value})`;
    bar.setAttribute('aria-valuenow', String(Math.round(value * 100)));
  }
}
