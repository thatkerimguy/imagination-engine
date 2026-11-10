import { diceTotal, type DiceState } from '../games/dice.ts';
import type { MemoryState } from '../games/memory.ts';
import type { SliderState } from '../games/slider.ts';
import { el, Painter, pressButton, type TemplateView } from './dom.ts';

/* The three games played on a board of buttons: memory pads, dice and the slider puzzle. */

const PAD_GLYPHS = ['◆', '●', '▲', '■', '★', '✚'] as const;

export const memoryView: TemplateView<MemoryState> = (field, s, ctx) => {
  const paint = new Painter();
  const board = el('div', 'ie-mini__pads', field);
  board.dataset.count = String(s.pads);
  /** The pad the reader last pressed and until when it stays marked. */
  let pressed = -1;
  let pressedUntil = 0;
  const pads = Array.from({ length: s.pads }, (_, index) => {
    const pad = pressButton('ie-mini__pad', board, () => {
      pressed = index;
      pressedUntil = performance.now() + 160;
      ctx.emit({ kind: 'pick', index });
    });
    pad.textContent = PAD_GLYPHS[index] ?? String(index + 1);
    pad.dataset.testid = `minigame-pad-${index}`;
    pad.setAttribute('aria-label', ctx.t('mini.memory.pad', { n: index + 1 }));
    return pad;
  });

  return {
    draw() {
      if (pressed >= 0 && performance.now() > pressedUntil) pressed = -1;
      pads.forEach((pad, i) => {
        paint.data(`lit${i}`, pad, 'lit', String(s.lit === i || pressed === i));
      });
      paint.data('phase', board, 'phase', s.phase);
      // The sequence itself is never written into the page: only the pad lit right now.
      paint.data('showing', board, 'showing', String(s.lit));
      paint.when('status', `${s.phase}:${s.round}`, () =>
        ctx.status(
          ctx.t(s.phase === 'show' ? 'mini.memory.watch' : 'mini.memory.repeat', {
            n: Math.min(s.round + 1, s.rounds),
            total: s.rounds,
          }),
        ),
      );
    },
  };
};

export const diceView: TemplateView<DiceState> = (field, s, ctx) => {
  const paint = new Painter();
  const row = el('div', 'ie-mini__dice', field);
  const dice = s.faces.map((_, index) => {
    const die = pressButton('ie-mini__die', row, () => ctx.emit({ kind: 'pick', index }));
    die.dataset.testid = `minigame-die-${index}`;
    return die;
  });
  const roll = pressButton('ie-button ie-button--primary ie-mini__primary', field, () =>
    ctx.emit({ kind: 'press' }),
  );
  roll.dataset.primary = '';
  roll.dataset.testid = 'minigame-primary';

  return {
    draw() {
      const tumbling = s.tumbling > 0;
      // While they tumble the dice flicker through faces; the real ones show when they settle.
      const flicker = tumbling ? Math.floor(s.tumbling * 24) : -1;
      dice.forEach((die, i) => {
        const rolling = tumbling && !s.held[i];
        const face = rolling ? ((flicker + i * 3) % s.sides) + 1 : (s.faces[i] ?? 0);
        paint.text(`face${i}`, die, face ? String(face) : '?');
        paint.data(`held${i}`, die, 'held', String(s.held[i] === true));
        paint.when(`label${i}`, `${rolling}:${face}:${s.held[i]}`, () =>
          die.setAttribute(
            'aria-label',
            ctx.t('mini.dice.die', { n: i + 1, face: face || '?' }) +
              (s.held[i] ? ` (${ctx.t('mini.dice.kept')})` : ''),
          ),
        );
      });
      paint.data('tumbling', row, 'tumbling', String(tumbling));
      const left = s.rerolls - (s.thrown - 1);
      paint.text(
        'roll',
        roll,
        s.thrown === 0
          ? ctx.t('mini.dice.roll')
          : ctx.t('mini.dice.reroll', { n: Math.max(0, left) }),
      );
      paint.when('status', `${s.thrown}:${tumbling}`, () =>
        ctx.status(
          s.thrown === 0 || tumbling
            ? ctx.t('mini.dice.ready', { target: s.target })
            : ctx.t('mini.dice.status', { total: diceTotal(s), target: s.target }),
        ),
      );
    },
  };
};

export const sliderView: TemplateView<SliderState> = (field, s, ctx) => {
  const paint = new Painter();
  const board = el('div', 'ie-mini__tiles', field);
  board.style.setProperty('--mini-size', String(s.size));
  const cells = s.tiles.map((_, index) => {
    const cell = pressButton('ie-mini__tile', board, () => ctx.emit({ kind: 'pick', index }));
    cell.dataset.testid = `minigame-tile-${index}`;
    return cell;
  });

  return {
    draw() {
      cells.forEach((cell, i) => {
        const tile = s.tiles[i] ?? 0;
        paint.when(`tile${i}`, String(tile), () => {
          cell.textContent = tile ? String(tile) : '';
          cell.dataset.gap = String(tile === 0);
          cell.setAttribute(
            'aria-label',
            tile ? ctx.t('mini.slider.tile', { n: tile }) : ctx.t('mini.slider.gap'),
          );
        });
      });
      paint.when('status', String(s.moves), () =>
        ctx.status(ctx.t('mini.slider.status', { n: s.moves })),
      );
    },
  };
};
