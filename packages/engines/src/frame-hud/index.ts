// frame-hud: LitRPG panels, bounty boards, tarot cards, royal decrees, terminals. One 0.8 s
// scanline sweep + staggered line fades on high, a 0.25 s fade on lite, a static card when reduced.
import {
  ACCENT_ROLES,
  propList,
  propText,
  type AccentRole,
  type GimmickEngine,
} from '@kn/core/gimmicks';
import { accentVar, cls, el, injectEngineStyle } from '../shared/dom-safe.ts';
import { cue, mountFrame, stagger, variantOf } from '../shared/kit.ts';
import { createBeat } from './beat.ts';
import { CSS } from './styles.ts';

const LAYOUTS = ['system', 'bounty', 'tarot', 'decree', 'terminal'] as const;
const STEP_MS = 50;
const c = (part: string): string => cls('frame-hud', part);

export const frameHudEngine: GimmickEngine = {
  id: 'frame-hud',
  mount(host, blueprint, props, ctx) {
    injectEngineStyle('frame-hud', CSS);
    const layout = variantOf(blueprint, props, 'layout', LAYOUTS);
    const header = propText(props, 'header');
    const { root, body } = mountFrame(host, blueprint, ctx, {
      layout,
      label: header || propText(props, 'title'),
    });
    const role = props.accentRole;
    if (typeof role === 'string' && (ACCENT_ROLES as readonly string[]).includes(role)) {
      root.style.setProperty('--kn-e-accent', accentVar(role as AccentRole));
    }
    const lines = propList(props, 'lines');
    const badge = propText(props, 'badge');
    body.append(
      el(
        'div',
        { class: c('hdr') },
        el('span', {}, header),
        el('span', { class: c('badge') }, badge),
      ),
      el('h3', { class: c('title') }, propText(props, 'title')),
      el(
        'ul',
        { class: c('lines') },
        ...lines.map((text, i) => {
          const li = el('li', { class: c('line') }, text);
          li.style.setProperty('--d', `${stagger(ctx, i, STEP_MS)}ms`);
          return li;
        }),
      ),
      el('p', { class: c('ftr') }, propText(props, 'footer')),
    );
    root.append(
      el('div', { class: c('sweep'), 'aria-hidden': 'true' }, el('div', { class: c('sheen') })),
    );
    const duration = (): number =>
      ctx.tier === 'lite' ? 250 : stagger(ctx, lines.length, STEP_MS) + 800;
    return createBeat(ctx, root, duration, () => cue(ctx, blueprint, props));
  },
};

export default frameHudEngine;
