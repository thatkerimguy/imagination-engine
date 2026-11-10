import type { LockpickState } from '../games/lockpick.ts';
import type { QteState } from '../games/qte.ts';
import type { TensionState } from '../games/tension.ts';
import { DIRECTIONS, type Direction } from '../types.ts';
import { el, Painter, pressButton, type TemplateView } from './dom.ts';

/* The three games played against a moving mark: lockpick, quick time and tension. */

const ARROWS: Readonly<Record<Direction, string>> = { up: '↑', right: '→', down: '↓', left: '←' };

/** A track with a zone on it and a marker that slides along it. */
function track(parent: HTMLElement) {
  const root = el('div', 'ie-mini__track', parent);
  const zoneRunner = el('div', 'ie-mini__runner', root);
  const zone = el('span', 'ie-mini__zone', zoneRunner);
  const markerRunner = el('div', 'ie-mini__runner', root);
  el('span', 'ie-mini__marker', markerRunner);
  return { root, zoneRunner, zone, markerRunner };
}

export const lockpickView: TemplateView<LockpickState> = (field, s, ctx) => {
  const paint = new Painter();
  const pins = el('div', 'ie-mini__pins', field);
  const pinNodes = Array.from({ length: s.pins }, () => el('span', 'ie-mini__pin', pins));
  const bar = track(field);
  bar.zone.style.width = `${(s.zone * 100).toFixed(2)}%`;
  const press = () => ctx.emit({ kind: 'press' });
  bar.root.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    press();
  });
  const set = pressButton('ie-button ie-button--primary ie-mini__primary', field, press);
  set.textContent = ctx.t('mini.lockpick.set');
  set.dataset.primary = '';
  set.dataset.testid = 'minigame-primary';

  return {
    draw() {
      const center = s.centers[Math.min(s.opened, s.pins - 1)] ?? 0.5;
      // The runner is as wide as the track, so percent of itself is percent of the track.
      paint.shift('zone', bar.zoneRunner, (center - s.zone / 2) * 100);
      paint.shift('marker', bar.markerRunner, s.pos * 100);
      paint.data('last', bar.root, 'last', `${s.last ?? ''}${s.opened}${s.triesLeft}`);
      pinNodes.forEach((pin, i) => {
        paint.text(`pin${i}`, pin, i < s.opened ? '◆' : '◇');
      });
      paint.when('status', `${s.opened}:${s.triesLeft}`, () =>
        ctx.status(
          ctx.t('mini.lockpick.status', {
            n: Math.min(s.opened + 1, s.pins),
            total: s.pins,
            tries: s.triesLeft,
          }),
        ),
      );
    },
  };
};

export const qteView: TemplateView<QteState> = (field, s, ctx) => {
  const paint = new Painter();
  const prompt = el('div', 'ie-mini__prompt', field);
  prompt.dataset.testid = 'minigame-prompt';
  const pad = el('div', 'ie-mini__dpad', field);
  for (const dir of DIRECTIONS) {
    const button = pressButton('ie-mini__key', pad, () => ctx.emit({ kind: 'dir', dir }));
    button.textContent = ARROWS[dir];
    button.dataset.dir = dir;
    button.setAttribute('aria-label', ctx.t(`mini.dir.${dir}`));
  }

  return {
    draw() {
      const dir = s.phase === 'prompt' ? s.prompts[s.index] : undefined;
      paint.text('prompt', prompt, dir ? ARROWS[dir] : '·');
      paint.data('dir', prompt, 'dir', dir ?? '');
      paint.data('last', prompt, 'last', `${s.last ?? ''}${s.index}`);
      const waiting = s.phase === 'gap' && s.index === 0;
      paint.when('status', `${waiting}:${s.index}:${s.slipsLeft}`, () =>
        ctx.status(
          waiting
            ? ctx.t('mini.qte.wait')
            : ctx.t('mini.qte.status', {
                n: Math.min(s.index + 1, s.prompts.length),
                total: s.prompts.length,
                slips: Math.max(0, s.slipsLeft),
              }),
        ),
      );
    },
  };
};

export const tensionView: TemplateView<TensionState> = (field, s, ctx) => {
  const paint = new Painter();
  const progress = el('div', 'ie-mini__meter', field);
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-label', ctx.t('mini.tension.progress'));
  const fill = el('span', 'ie-mini__meter-fill', progress);
  const bar = track(field);
  bar.zone.style.width = `${(s.zone * 100).toFixed(2)}%`;
  const hold = el('button', 'ie-button ie-button--primary ie-mini__primary', field);
  hold.type = 'button';
  hold.textContent = ctx.t('mini.tension.hold');
  hold.dataset.primary = '';
  hold.dataset.testid = 'minigame-primary';

  // Holding anywhere on the game pulls; lifting, leaving or losing the pointer lets go.
  const down = (event: PointerEvent) => {
    if (event.button > 0) return;
    event.preventDefault();
    ctx.emit({ kind: 'press' });
  };
  const up = () => ctx.emit({ kind: 'release' });
  field.addEventListener('pointerdown', down);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  window.addEventListener('blur', up);

  return {
    draw() {
      paint.shift('zone', bar.zoneRunner, (s.center - s.zone / 2) * 100);
      paint.shift('marker', bar.markerRunner, s.pos * 100);
      paint.scale('progress', fill, s.progress);
      paint.data('held', field, 'held', String(s.held));
      paint.when('status', '', () => ctx.status(ctx.t('mini.tension.status')));
    },
    dispose() {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', up);
    },
  };
};
