// bespoke-3d: hand-crafted 3D hero spectacles (3D dice throw, brass lighter) on the single shared
// WebGL stage. three.js + cannon-es live only in this lazy chunk. Tiers: high = WebGL, lite = CSS
// dice / calm caption, reduced or Calm Mode = a serene static badge. A live drop to reduced
// stops the frame loop, clears and hides the stage canvas and silences sound immediately.
import {
  propBool,
  propList,
  propNumber,
  propText,
  type EngineInstance,
  type GimmickEngine,
} from '@kn/core/gimmicks';
import { cls, el, injectEngineStyle } from '../shared/dom-safe.ts';
import { rt } from '../shared/i18n-reader.ts';
import { isStill, mountFrame, variantOf } from '../shared/kit.ts';
import { describeRoll } from './dice/faces.ts';
import { DICE_MATERIALS, type DiceMaterial } from './dice/palette.ts';
import { playDiceLite } from './lite.ts';
import { CSS } from './styles.ts';
import { SPECTACLES, type Running } from './types.ts';

const ID = 'bespoke-3d';
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ');

export const bespoke3dEngine: GimmickEngine = {
  id: ID,
  mount(host, blueprint, props, ctx): EngineInstance {
    injectEngineStyle(ID, CSS);
    const spectacle = variantOf(blueprint, props, 'spectacle', SPECTACLES);
    const dice = spectacle === 'dice-throw';
    const count = Math.min(4, Math.max(1, Math.round(propNumber(props, 'count', 2))));
    const mat = propText(props, 'material', 'ivory') as DiceMaterial;
    const material: DiceMaterial = DICE_MATERIALS.includes(mat) ? mat : 'ivory';
    const scripted = propList(props, 'values')
      .map((v) => Math.round(Number(v)))
      .filter((v) => v >= 1 && v <= 6);
    const fixed = scripted.length > 0 ? scripted : null;
    const settle = (vals: number[]): (Node | string)[] => {
      if (!dice) return [propText(props, 'settledText', 'The lighter flame steadies.')];
      const outcome = describeRoll(vals).trim();
      return [
        el(
          'span',
          { class: cls(ID, 'line') },
          `${count}× D6 ${cap(material)} settle on `,
          el('span', { class: cls(ID, 'vals') }, `[${vals.join(', ')}]`),
        ),
        ...(outcome ? [el('span', { class: cls(ID, 'sub') }, outcome)] : []),
      ];
    };
    const caption = propText(props, 'caption');
    const tapMode = propText(props, 'trigger', 'auto') === 'tap';
    const { root, body } = mountFrame(host, blueprint, ctx, {
      label: caption || blueprint.name,
      layout: spectacle,
    });
    const go = el(
      'button',
      { type: 'button', class: cls(ID, 'go'), hidden: true },
      dice ? rt('rollDice') : rt('strikeLighter'),
    );
    const tray = el('div', { class: cls(ID, 'tray') });
    const result = el('p', { class: cls(ID, 'result'), 'aria-live': 'polite' });
    body.append(el('p', { class: cls(ID, 'cap') }, caption), go, tray, result);

    let running: Running | null = null;
    let landed = false;
    let destroyed = false;
    const roll = (): number[] =>
      Array.from({ length: count }, (_, i) => fixed?.[i] ?? 1 + Math.floor(Math.random() * 6));
    const land = (vals: number[]): void => {
      if (landed || destroyed) return;
      landed = true;
      go.hidden = true;
      result.replaceChildren(...settle(vals));
      root.dataset.state = 'done';
    };
    /** Calm path: everything in flight stops now; the static badge is the whole beat. */
    const calm = (): void => {
      running?.stop();
      running = null;
      tray.replaceChildren();
      land(fixed ?? roll());
    };
    ctx.onTierChange(() => isStill(ctx) && calm());
    if (isStill(ctx)) calm();

    const waitTap = (): Promise<void> =>
      new Promise((resolve) => {
        go.hidden = false;
        root.dataset.state = 'ready';
        const off = new AbortController();
        const done = (): void => (off.abort(), resolve());
        go.addEventListener('click', done, { signal: off.signal });
        ctx.signal.addEventListener('abort', done, { signal: off.signal });
        ctx.onTierChange(() => isStill(ctx) && done());
      });

    const play = async (): Promise<void> => {
      if (tapMode) await waitTap();
      if (destroyed || landed || isStill(ctx)) return;
      go.hidden = true;
      const sound = propBool(props, 'sound', true);
      const holdSeconds = Math.min(6, Math.max(0.3, propNumber(props, 'holdSeconds', 1.5)));
      if (ctx.tier === 'high') {
        try {
          if (dice) {
            const m = await import('./dice/high.ts');
            if (destroyed || isStill(ctx)) return;
            const throwFrom = propText(props, 'throwFrom', 'right');
            const from = throwFrom === 'left' || throwFrom === 'bottom' ? throwFrom : 'right';
            running = m.playDiceHigh(
              ctx,
              { count, values: fixed, material, holdSeconds, throwFrom: from, sound },
              land,
            );
          } else {
            const m = await import('./zippo/high.ts');
            if (destroyed || isStill(ctx)) return;
            const finish = material === 'obsidian' ? 'obsidian' : 'brass';
            running = m.playZippoHigh(ctx, { finish, holdSeconds, sound });
          }
          await running.done;
          return land(running.values ?? roll());
        } catch (err) {
          console.warn('[bespoke-3d] WebGL unavailable, using lite tier', err);
        }
      }
      if (destroyed || isStill(ctx)) return;
      const vals = roll();
      running = dice ? playDiceLite(ctx, tray, vals, material) : null;
      await running?.done;
      land(vals);
    };

    let playing: Promise<void> | null = null;
    return {
      trigger(): Promise<void> {
        if (landed || destroyed) return Promise.resolve();
        playing ??= play().finally(() => (running = null));
        return playing;
      },
      destroy(): void {
        if (destroyed) return;
        destroyed = true;
        running?.stop();
        running = null;
        root.remove();
      },
    };
  },
};

export default bespoke3dEngine;
