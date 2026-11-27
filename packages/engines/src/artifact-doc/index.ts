// artifact-doc: dossiers, diaries, newsprint, tickets, contracts. The frame supplies the surface
// tile; the beat is one stamp landing (scale 1.4 -> 1, 350 ms) with the blueprint cue.
import { propList, propText, type GimmickEngine } from '@kn/core/gimmicks';
import { cls, el, injectEngineStyle } from '../shared/dom-safe.ts';
import { cue, mountFrame, variantOf } from '../shared/kit.ts';
import { createBeat } from '../frame-hud/beat.ts';
import { CSS } from './styles.ts';

const DOC_TYPES = ['dossier', 'diary', 'newsprint', 'ticket', 'contract'] as const;
const c = (part: string): string => cls('artifact-doc', part);

export const artifactDocEngine: GimmickEngine = {
  id: 'artifact-doc',
  mount(host, blueprint, props, ctx) {
    injectEngineStyle('artifact-doc', CSS);
    const layout = variantOf(blueprint, props, 'docType', DOC_TYPES);
    const heading = propText(props, 'heading');
    const { root, body } = mountFrame(host, blueprint, ctx, {
      layout,
      label: heading,
      tag: 'article',
    });
    const stamp = propText(props, 'stamp');
    const signature = propText(props, 'signature');
    const sections: Node[] = [
      el(
        'div',
        { class: c('top') },
        el('span', { class: c('ref') }, propText(props, 'referenceNo')),
        el('h3', { class: c('heading') }, heading),
      ),
      el('div', { class: c('meta') }, ...propList(props, 'meta').map((m) => el('span', {}, m))),
      el('div', { class: c('paras') }, ...propList(props, 'body').map((p) => el('p', {}, p))),
    ];
    if (signature) sections.push(el('p', { class: c('sig') }, signature));
    if (stamp) sections.push(el('span', { class: c('stamp') }, stamp));
    body.append(...sections);
    return createBeat(
      ctx,
      root,
      () => (ctx.tier === 'lite' ? 250 : 350),
      () => cue(ctx, blueprint, props),
    );
  },
};

export default artifactDocEngine;
