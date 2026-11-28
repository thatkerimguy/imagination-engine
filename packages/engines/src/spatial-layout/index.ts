// spatial-layout: prose set in space. Two synchronized columns at >= 520 px that collapse into
// labelled alternating blocks on narrow phones (no horizontal overflow), or a stepped poem.
import {
  propRecords,
  propText,
  type EngineInstance,
  type GimmickEngine,
  type Unsubscribe,
} from '@kn/core/gimmicks';
import { cls, el, injectEngineStyle } from '../shared/dom-safe.ts';
import { cue, isStill, mountFrame, stagger, variantOf } from '../shared/kit.ts';
import { CSS } from './styles.ts';

const ID = 'spatial-layout';
const LAYOUTS = ['dual-pov', 'staggered-echo', 'split-timeline', 'falling-lines'] as const;
const COLS = ['left', 'right', 'center'] as const;
type Col = (typeof COLS)[number];
const STEP_MS = 60;
const ENTER_MS = 360;
const MAX_ROWS = 16;

export const spatialLayoutEngine: GimmickEngine = {
  id: ID,
  mount(host, blueprint, props, ctx): EngineInstance {
    injectEngineStyle(ID, CSS);
    const layout = variantOf(blueprint, props, 'layout', LAYOUTS);
    const two = layout === 'dual-pov' || layout === 'split-timeline';
    const labels = { left: propText(props, 'leftLabel'), right: propText(props, 'rightLabel') };
    const { root, body } = mountFrame(host, blueprint, ctx, { layout, label: blueprint.name });

    const grid = el('div', { class: cls(ID, 'grid') });
    if (two && (labels.left || labels.right)) {
      grid.append(
        el(
          'div',
          { class: cls(ID, 'head'), 'aria-hidden': 'true' },
          labels.left ? el('span', { 'data-side': 'left' }, labels.left) : null,
          labels.right ? el('span', { 'data-side': 'right' }, labels.right) : null,
        ),
      );
    }
    const rows = propRecords(props, 'entries').slice(0, MAX_ROWS);
    rows.forEach((r, i) => {
      const want = String(r.col ?? '');
      const col: Col = !two
        ? 'center'
        : (COLS as readonly string[]).includes(want)
          ? (want as Col)
          : i % 2
            ? 'right'
            : 'left';
      const given = Number(r.indent);
      const auto =
        layout === 'falling-lines' ? Math.min(i, 8) : layout === 'staggered-echo' ? (i % 4) * 2 : 0;
      const indent =
        Number.isFinite(given) && r.indent !== undefined ? Math.max(0, Math.min(12, given)) : auto;
      const tag = col === 'center' ? '' : labels[col];
      const cell = el(
        'div',
        { class: cls(ID, 'cell'), 'data-col': col },
        tag ? el('span', { class: cls(ID, 'tag') }, tag) : null,
        el('p', {}, String(r.text ?? '')),
      );
      cell.style.setProperty('--ind', String(indent));
      cell.style.setProperty('--d', `${Math.min(70 * i, stagger(ctx, i, STEP_MS))}ms`);
      grid.append(cell);
    });
    body.append(grid);

    let destroyed = false;
    let settle: (() => void) | null = null;
    let stop: Unsubscribe | null = null;
    const land = (): void => {
      stop?.();
      stop = null;
      root.dataset.state = 'done';
      settle?.();
      settle = null;
    };
    ctx.onTierChange(() => isStill(ctx) && land());
    ctx.onPause(() => root.setAttribute('data-paused', ''));
    ctx.onResume(() => root.removeAttribute('data-paused'));
    ctx.signal.addEventListener('abort', land, { once: true });
    if (isStill(ctx)) root.dataset.state = 'done';

    return {
      trigger(): Promise<void> {
        if (destroyed || settle || root.dataset.state === 'done') return Promise.resolve();
        cue(ctx, blueprint, props);
        if (isStill(ctx)) {
          land();
          return Promise.resolve();
        }
        root.dataset.state = 'playing';
        return new Promise<void>((resolve) => {
          settle = resolve;
          const last = Math.min(70 * rows.length, stagger(ctx, rows.length, STEP_MS));
          stop = ctx.timeout(land, last + ENTER_MS);
        });
      },
      destroy(): void {
        if (destroyed) return;
        destroyed = true;
        land();
        root.remove();
      },
    };
  },
};

export default spatialLayoutEngine;
