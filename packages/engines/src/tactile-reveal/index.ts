// tactile-reveal: a physical gesture (seal, scratch, hold, wipe) that uncovers hidden text.
// Reader-driven: trigger() only plays a short attention cue; revealing is the reader's act.
import {
  propList,
  propText,
  type EngineInstance,
  type GimmickEngine,
  type Unsubscribe,
} from '@kn/core/gimmicks';
import { cls, el, injectEngineStyle, svgEl } from '../shared/dom-safe.ts';
import { cue, isStill, mountFrame, variantOf } from '../shared/kit.ts';
import { CSS } from './styles.ts';

const ID = 'tactile-reveal';
const MECHANISMS = ['wax-seal', 'scratch-off', 'biometric-hold', 'fog-wipe'] as const;
const HOLD_MS = 650;
const CUE_MS = 600;
const COLS = 8;
const ROWS = 5;
const NEED = 0.35;
let uid = 0;

const CRACK = 'L46 76 L52 60 L45 44 L51 28 Z';

function sealSvg(): SVGSVGElement {
  const half = (side: 'l' | 'r'): SVGPathElement =>
    svgEl('path', {
      class: `${cls(ID, 'half')} ${cls(ID, `half-${side}`)}`,
      d: `M50 6 A44 44 0 0 ${side === 'l' ? 0 : 1} 50 94 ${CRACK}`,
    });
  return svgEl(
    'svg',
    { viewBox: '0 0 100 100', class: cls(ID, 'svg'), 'aria-hidden': 'true', focusable: 'false' },
    half('l'),
    half('r'),
    svgEl('circle', { class: cls(ID, 'rim'), cx: 50, cy: 50, r: 30 }),
  );
}

function ringSvg(): SVGSVGElement {
  const arc = (d: string): SVGPathElement => svgEl('path', { class: cls(ID, 'print'), d });
  return svgEl(
    'svg',
    { viewBox: '0 0 100 100', class: cls(ID, 'svg'), 'aria-hidden': 'true', focusable: 'false' },
    svgEl('circle', { class: cls(ID, 'track'), cx: 50, cy: 50, r: 44 }),
    svgEl('circle', {
      class: cls(ID, 'bar'),
      cx: 50,
      cy: 50,
      r: 44,
      pathLength: 100,
      transform: 'rotate(-90 50 50)',
    }),
    arc('M34 60 A16 16 0 0 1 66 60'),
    arc('M40 66 A10 10 0 0 1 60 66'),
    arc('M46 72 A4 4 0 0 1 54 72'),
    arc('M30 52 A20 20 0 0 1 70 52'),
  );
}

export const tactileRevealEngine: GimmickEngine = {
  id: ID,
  mount(host, blueprint, props, ctx): EngineInstance {
    injectEngineStyle(ID, CSS);
    const mech = variantOf(blueprint, props, 'mechanism', MECHANISMS);
    const label = propText(props, 'label', 'Reveal');
    const { root, body } = mountFrame(host, blueprint, ctx, { label, layout: mech });
    const rid = `kn-tr-${++uid}`;
    const wipe = mech === 'scratch-off' || mech === 'fog-wipe';
    const cover = el('div', { class: cls(ID, 'cover'), 'aria-hidden': 'true' });
    const stage = el(
      'div',
      { class: cls(ID, 'stage') },
      mech === 'wax-seal' ? sealSvg() : null,
      mech === 'biometric-hold' ? ringSvg() : null,
      wipe ? el('span', { class: cls(ID, 'peek'), 'aria-hidden': 'true' }, '?') : null,
      wipe ? cover : null,
    );
    const btn = el(
      'button',
      {
        type: 'button',
        class: cls(ID, 'btn'),
        'aria-label': label,
        'aria-expanded': 'false',
        'aria-controls': rid,
      },
      stage,
      el('span', { class: cls(ID, 'hint') }, label),
    );
    const region = el(
      'div',
      { id: rid, class: cls(ID, 'region'), hidden: true },
      el('h3', { class: cls(ID, 'title') }, propText(props, 'revealedTitle')),
      ...propList(props, 'revealedBody').map((line) => el('p', {}, line)),
    );
    body.append(el('p', { class: cls(ID, 'prompt') }, propText(props, 'prompt')), btn, region);

    let done = false;
    let destroyed = false;
    let holdStop: Unsubscribe | null = null;
    let endCue: (() => void) | null = null;
    let cuePromise: Promise<void> | null = null;
    const cells = new Set<number>();
    let down = false;
    let dragged = false;
    const rich = (): boolean => ctx.tier === 'high' && !isStill(ctx);

    const cancelHold = (): void => {
      holdStop?.();
      holdStop = null;
    };
    const reveal = (): void => {
      if (done || destroyed) return;
      done = true;
      cancelHold();
      endCue?.();
      btn.setAttribute('aria-expanded', 'true');
      region.hidden = false;
      root.dataset.state = 'done';
      root.classList.add('is-open');
      cue(ctx, blueprint, props);
    };
    const startHold = (): void => {
      if (done || holdStop) return;
      root.classList.add('is-holding');
      ctx.haptics('tap');
      const stopPulse = ctx.interval(() => ctx.haptics('tap'), 210);
      const stopDone = ctx.timeout(() => {
        holdStop = null;
        stopPulse();
        reveal();
      }, HOLD_MS);
      holdStop = () => {
        stopPulse();
        stopDone();
        root.classList.remove('is-holding');
      };
    };
    const sweep = (e: PointerEvent): void => {
      const r = btn.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / (r.width || 360)) * COLS);
      const y = Math.floor(((e.clientY - r.top) / (r.height || 160)) * ROWS);
      cells.add(Math.min(ROWS - 1, Math.max(0, y)) * COLS + Math.min(COLS - 1, Math.max(0, x)));
      const f = cells.size / (COLS * ROWS);
      cover.style.opacity = String(Math.max(0, 1 - f / NEED));
      if (f >= NEED) reveal();
    };
    const capture = (e: PointerEvent): void => {
      if (typeof btn.setPointerCapture !== 'function') return;
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic or released pointers cannot be captured; the gesture still works.
      }
    };
    const on = <K extends keyof HTMLElementEventMap>(
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
    ): void => btn.addEventListener(type, fn, { signal: ctx.signal });
    const holdKey = (e: KeyboardEvent): boolean =>
      e.key === ' ' && mech === 'biometric-hold' && rich();

    on('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        reveal();
      } else if (holdKey(e)) {
        e.preventDefault();
        if (!e.repeat) startHold();
      }
    });
    on('keyup', (e) => {
      if (!holdKey(e)) return;
      e.preventDefault();
      cancelHold();
    });
    on('blur', cancelHold);
    on('pointerdown', (e) => {
      if (done || !rich()) return;
      if (mech === 'biometric-hold') {
        capture(e);
        startHold();
      } else if (wipe) {
        capture(e);
        down = true;
        dragged = false;
        sweep(e);
      }
    });
    on('pointermove', (e) => {
      if (!down || done) return;
      dragged = true;
      sweep(e);
    });
    const release = (): void => {
      down = false;
      if (mech === 'biometric-hold') cancelHold();
    };
    on('pointerup', release);
    on('pointercancel', release);
    on('click', (e) => {
      if (rich() && e.detail !== 0) {
        if (mech === 'biometric-hold') return;
        if (wipe && dragged) {
          dragged = false;
          return;
        }
      }
      reveal();
    });

    ctx.onTierChange(() => {
      if (!isStill(ctx)) return;
      cancelHold();
      reveal();
    });
    if (isStill(ctx)) reveal();

    return {
      trigger(): Promise<void> {
        if (destroyed || done || isStill(ctx)) return Promise.resolve();
        cuePromise ??= new Promise<void>((resolve) => {
          root.dataset.state = 'ready';
          root.classList.add('is-cue');
          const end = (): void => {
            stop();
            root.classList.remove('is-cue');
            endCue = null;
            resolve();
          };
          const stop = ctx.timeout(end, CUE_MS);
          endCue = end;
          ctx.signal.addEventListener('abort', end, { once: true });
        });
        return cuePromise;
      },
      destroy(): void {
        if (destroyed) return;
        destroyed = true;
        cancelHold();
        endCue?.();
        root.remove();
      },
    };
  },
};

export default tactileRevealEngine;
