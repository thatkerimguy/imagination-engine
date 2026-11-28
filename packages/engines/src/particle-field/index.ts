// particle-field: one 2D canvas of drifting particles in a bounded inline band (or a fixed
// backdrop). raf-driven with dt clamped; calm form is a serene hairline + caption.
import {
  propBool,
  propNumber,
  propText,
  type EngineInstance,
  type GimmickEngine,
  type Unsubscribe,
} from '@kn/core/gimmicks';
import { cls, el, injectEngineStyle } from '../shared/dom-safe.ts';
import { rt } from '../shared/i18n-reader.ts';
import { isStill, mountFrame, variantOf } from '../shared/kit.ts';
import { paint, PRESETS, spawn, step, type P } from './sim.ts';
import { CSS } from './styles.ts';

const ID = 'particle-field';
const EMBER_LIGHT = '#b23a0e'; // deep burnt amber/crimson: contrast on a light page
const ROLE_VAR: Record<string, [string, string]> = {
  primary: ['--dna-accent', '#4fd1c5'],
  secondary: ['--dna-accent-2', '#b794f4'],
  warning: ['--dna-warn', '#f6ad55'],
  neutral: ['--dna-muted', '#a0aec0'],
};

export const particleFieldEngine: GimmickEngine = {
  id: ID,
  mount(host, blueprint, props, ctx): EngineInstance {
    injectEngineStyle(ID, CSS);
    const preset = variantOf(blueprint, props, 'preset', PRESETS);
    const density = Math.max(2, Math.round(propNumber(props, 'density', 24)));
    const wind = Math.max(-1, Math.min(1, propNumber(props, 'wind', 0.2)));
    const speed = Math.max(0.2, Math.min(2, propNumber(props, 'speed', 1)));
    const caption = propText(props, 'caption');
    const fullBleed = propBool(props, 'fullBleed');
    const roleVar = ROLE_VAR[propText(props, 'colorRole', 'primary')] ?? ROLE_VAR.primary!;
    const { root, body } = mountFrame(host, blueprint, ctx, {
      layout: preset,
      surface: false,
      ornament: false,
      label: caption || rt('visualEffect'),
    });

    const canvas = el('canvas', { class: cls(ID, 'canvas'), 'aria-hidden': 'true' });
    const box = el(
      'div',
      { class: cls(ID, fullBleed ? 'back' : 'band'), 'aria-hidden': 'true' },
      canvas,
    );
    if (fullBleed) document.body.append(box);
    else body.append(box);
    body.append(
      el('div', { class: cls(ID, 'hair') }),
      el('p', { class: cls(ID, 'cap'), hidden: !caption }, caption),
    );
    let g: CanvasRenderingContext2D | null = null;
    try {
      g = canvas.getContext('2d');
    } catch {
      g = null;
    }

    const cap = (): number => Math.min(density, ctx.tier === 'high' ? 45 : 18);
    const calm = (): boolean => isStill(ctx) || !g;
    let ps: P[] = [];
    let w = 320;
    let h = 120;
    let color = '#fff';
    let light = ctx.dna.theme === 'light';
    let visible = true;
    const measure = (): void => {
      w = box.clientWidth || (fullBleed ? window.innerWidth : 320);
      h = box.clientHeight || (fullBleed ? window.innerHeight : 120);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      g?.setTransform(dpr, 0, 0, dpr, 0, 0);
      const v = getComputedStyle(root).getPropertyValue(roleVar[0]).trim();
      color = v || roleVar[1];
      if (light && preset === 'embers') color = EMBER_LIGHT;
    };
    const seed = (): void => {
      measure();
      const n = cap();
      ps = ps.slice(0, n);
      while (ps.length < n) ps.push(spawn(preset, w, h, true));
    };

    let stop: Unsubscribe | null = null;
    let last: number | null = null;
    let acc = 0;
    let destroyed = false;
    const frame = (t: number): void => {
      stop = null;
      const dt = last === null ? 16 : Math.min(50, t - last);
      last = t;
      acc += dt;
      if (ctx.tier !== 'lite' || acc >= 33) {
        const sec = acc / 1000;
        acc = 0;
        for (const p of ps) step(p, preset, sec, wind, speed, w, h);
        g!.clearRect(0, 0, w, h);
        paint(g!, ps, preset, color, h, light);
      }
      stop = ctx.raf(frame);
    };
    const halt = (): void => {
      stop?.();
      stop = null;
    };
    const run = (): void => {
      if (stop || destroyed || !visible || calm() || ctx.paused || ctx.tier === 'reduced') return;
      last = null;
      stop = ctx.raf(frame);
    };
    const sync = (): void => {
      root.dataset.still = String(calm());
      if (calm()) {
        halt();
        g?.clearRect(0, 0, w, h);
      } else {
        if (ps.length === 0 || ps.length > cap()) seed();
        run();
      }
    };
    ctx.onTierChange(sync);
    ctx.onDnaChange((dna) => {
      light = dna.theme === 'light';
      if (!calm()) measure();
    });
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          const last = entries[entries.length - 1];
          if (!last) return;
          visible = last.isIntersecting;
          if (visible) run();
          else halt();
        },
        { threshold: 0.05 },
      );
      io.observe(box);
    }
    const unobserve = (): void => {
      io?.disconnect();
      io = null;
    };
    ctx.onPause(halt);
    ctx.onResume(run);
    window.addEventListener('resize', () => !calm() && measure(), { signal: ctx.signal });
    ctx.signal.addEventListener(
      'abort',
      () => {
        halt();
        unobserve();
      },
      { once: true },
    );
    sync();

    return {
      trigger(): Promise<void> {
        run();
        return Promise.resolve();
      },
      destroy(): void {
        if (destroyed) return;
        destroyed = true;
        halt();
        unobserve();
        box.remove();
        root.remove();
      },
    };
  },
};

export default particleFieldEngine;
