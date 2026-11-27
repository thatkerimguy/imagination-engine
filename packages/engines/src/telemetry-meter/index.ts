// telemetry-meter: a pure-SVG readout (bars, countdown, ekg, radar, compass) that lands on a value.
import {
  propNumber,
  propRecords,
  propText,
  type EngineInstance,
  type GimmickEngine,
  type Unsubscribe,
} from '@kn/core/gimmicks';
import { cls, el, injectEngineStyle, setText } from '../shared/dom-safe.ts';
import { cue, isStill, mountFrame, variantOf } from '../shared/kit.ts';
import { buildGfx, STYLES, type MeterItem } from './gfx.ts';
import { CSS } from './styles.ts';

const ID = 'telemetry-meter';
const INTRO_MS = 900;
const LITE_MS = 320;

const mmss = (s: number): string => {
  const n = Math.max(0, Math.round(s));
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
};

export const telemetryMeterEngine: GimmickEngine = {
  id: ID,
  mount(host, blueprint, props, ctx): EngineInstance {
    injectEngineStyle(ID, CSS);
    const style = variantOf(blueprint, props, 'style', STYLES);
    const label = propText(props, 'label', 'Reading');
    const unit = propText(props, 'unit');
    const value = Math.max(0, propNumber(props, 'value', 0));
    const max = Math.max(1, propNumber(props, 'max', 100));
    const threshold = typeof props.threshold === 'number' ? props.threshold : null;
    const items: MeterItem[] = propRecords(props, 'items').map((r) => ({
      name: String(r.name ?? '').slice(0, 24),
      value: Math.max(0, Number(r.value) || 0),
      max: Math.max(1, Number(r.max) || 100),
    }));
    const { root, body } = mountFrame(host, blueprint, ctx, { label, layout: style });
    // Depleting gauges (bars) warn at or below the threshold; every other style at or above it.
    const over = threshold !== null && (style === 'bars' ? value <= threshold : value >= threshold);
    root.dataset.over = String(over);

    const gfx = buildGfx(style, { label, value, max, items });
    const num = el('span', { class: cls(ID, 'num') }, '0');
    const readout = el(
      'div',
      {
        class: cls(ID, 'readout'),
        role: 'meter',
        'aria-label': label,
        'aria-valuemin': 0,
        'aria-valuemax': max,
        'aria-valuenow': 0,
      },
      num,
      style === 'countdown' || !unit ? null : el('small', { class: cls(ID, 'unit') }, unit),
    );
    body.append(el('div', { class: cls(ID, 'head') }, el('span', {}, label)), readout, gfx.svg);

    const fmt = (v: number): string => (style === 'countdown' ? mmss(v) : String(Math.round(v)));
    const draw = (v: number): void => {
      gfx.set(v);
      setText(num, fmt(v));
    };
    const announce = (v: number): void => {
      readout.setAttribute('aria-valuenow', String(Math.round(v)));
      readout.setAttribute(
        'aria-valuetext',
        style === 'countdown' ? mmss(v) : `${fmt(v)} ${unit}`.trim(),
      );
    };

    let destroyed = false;
    let landed = false;
    let stopRun: Unsubscribe | null = null;
    let stopTick: Unsubscribe | null = null;
    let run: Promise<void> | null = null;
    let settle: (() => void) | null = null;
    const cancelAll = (): void => {
      stopRun?.();
      stopRun = null;
      stopTick?.();
      stopTick = null;
    };
    const finishStatic = (): void => {
      cancelAll();
      draw(value);
      announce(value);
      landed = true;
      root.dataset.state = 'done';
      settle?.();
      settle = null;
    };
    const startTick = (): void => {
      let rem = value;
      stopTick = ctx.interval(() => {
        rem = Math.max(0, rem - 1);
        draw(rem);
        if (rem > 0) return;
        stopTick?.();
        stopTick = null;
        announce(0);
      }, 1000);
    };
    const land = (): void => {
      landed = true;
      root.dataset.state = 'done';
      announce(value);
      cue(ctx, blueprint, props);
      if (style === 'countdown' && value > 0 && ctx.tier === 'high') startTick();
      settle?.();
      settle = null;
    };
    const play = (): void => {
      root.dataset.state = 'playing';
      if (ctx.tier !== 'high') {
        draw(value);
        stopRun = ctx.timeout(land, LITE_MS);
        return;
      }
      const dur = INTRO_MS / ctx.dna.motion.tempo;
      let elapsed = 0;
      let last: number | null = null;
      const step = (t: number): void => {
        const dt = last === null ? 0 : Math.min(50, t - last);
        last = t;
        if (elapsed < dur) {
          elapsed += dt;
          const q = Math.min(1, elapsed / dur);
          draw(value * (1 - (1 - q) ** 3));
          if (elapsed >= dur) {
            draw(value);
            land();
          }
        }
        gfx.loop?.(dt);
        stopRun = elapsed < dur || gfx.loop ? ctx.raf(step) : null;
      };
      stopRun = ctx.raf(step);
    };

    ctx.onTierChange(() => {
      if (isStill(ctx)) finishStatic();
    });
    ctx.signal.addEventListener('abort', () => settle?.(), { once: true });
    if (isStill(ctx)) finishStatic();
    else {
      draw(0);
      announce(0);
    }

    return {
      trigger(): Promise<void> {
        if (destroyed || landed || isStill(ctx)) {
          if (!destroyed && !landed) finishStatic();
          return Promise.resolve();
        }
        run ??= new Promise<void>((resolve) => {
          settle = resolve;
          play();
        });
        return run;
      },
      destroy(): void {
        if (destroyed) return;
        destroyed = true;
        cancelAll();
        settle?.();
        settle = null;
        root.remove();
      },
    };
  },
};

export default telemetryMeterEngine;
