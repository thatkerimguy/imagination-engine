import { builtTotal, type BuiltState } from '../games/built.ts';
import { el, Painter, pressButton, type TemplateView } from './dom.ts';

/* A built game (ADR 0025): its meters as bars, its dice, and its buttons, in the author's words. */

export const builtView: TemplateView<BuiltState> = (field, s, ctx) => {
  const paint = new Painter();
  const word = (l: { en?: string; tr?: string }, fallback: string) =>
    l[ctx.locale] || l.en || l.tr || fallback;
  const game = s.game;

  const meterList = el('div', 'ie-mini__gauges', field);
  const meters = game.meters.map((m) => {
    const row = el('div', 'ie-mini__gauge', meterList);
    row.dataset.testid = `minigame-meter-${m.id}`;
    const name = el('span', 'ie-mini__gauge-name', row);
    name.textContent = word(m.label, m.id);
    const value = el('span', 'ie-mini__gauge-value', row);
    const bar = el('span', 'ie-mini__gauge-bar', row);
    const fill = el('span', 'ie-mini__gauge-fill', bar);
    return { m, value, fill, row };
  });

  let faces: HTMLElement[] = [];
  let roll: HTMLButtonElement | null = null;
  if (game.dice) {
    const row = el('div', 'ie-mini__dice', field);
    faces = Array.from({ length: game.dice.count }, (_, i) => {
      const die = el('span', 'ie-mini__die', row);
      die.dataset.testid = `minigame-die-${i}`;
      return die;
    });
    roll = pressButton('ie-button ie-mini__primary', field, () => ctx.emit({ kind: 'press' }));
    roll.dataset.testid = 'minigame-roll';
    roll.textContent = ctx.t('mini.dice.roll');
  }

  const pad = el('div', 'ie-mini__buttons', field);
  pad.dataset.count = String(game.buttons.length);
  game.buttons.forEach((b, index) => {
    const button = pressButton('ie-button ie-mini__choice', pad, () =>
      ctx.emit({ kind: 'pick', index }),
    );
    button.dataset.testid = `minigame-button-${index}`;
    button.textContent = word(b.label, String(index + 1));
  });

  return {
    draw() {
      paint.when('meters', String(s.version), () => {
        for (const { m, value, fill, row } of meters) {
          const v = s.values.get(m.id) ?? 0;
          value.textContent = `${v} / ${m.max}`;
          fill.style.transform = `scaleX(${(v / m.max).toFixed(3)})`;
          row.setAttribute('aria-label', `${word(m.label, m.id)}: ${v} / ${m.max}`);
        }
      });
      if (faces.length) {
        const tumbling = s.tumbling > 0;
        const flicker = tumbling ? Math.floor(s.tumbling * 24) : -1;
        const sides = game.dice?.sides ?? 6;
        faces.forEach((die, i) => {
          const face = tumbling ? ((flicker + i * 3) % sides) + 1 : (s.faces[i] ?? 0);
          paint.text(`face${i}`, die, face ? String(face) : '?');
        });
        paint.data('tumbling', field, 'tumbling', String(tumbling));
        paint.when('status', `${s.faces.join(',')}:${tumbling}`, () =>
          ctx.status(
            s.faces.length && !tumbling
              ? ctx.t('mini.built.rolled', { total: builtTotal(s) })
              : ctx.t('mini.built.ready'),
          ),
        );
        if (roll) roll.disabled = tumbling;
      } else {
        paint.when('status', 'ready', () => ctx.status(ctx.t('mini.built.ready')));
      }
    },
  };
};
