// text-alchemy: prose that rewrites itself. gaslight (swap on re-entry), whisper (ghost layer),
// redact (peelable ink bars), cipher (left-to-right decode). Reduced shows calm static forms.
import { propText, type GimmickEngine } from '@kn/core/gimmicks';
import { injectEngineStyle } from '../shared/dom-safe.ts';
import { cue, isStill, mountFrame, variantOf } from '../shared/kit.ts';
import { cipher, gaslight, redact, whisper, type AlchemyEnv } from './modes.ts';
import { CSS } from './styles.ts';

const MODES = ['gaslight', 'whisper', 'redact', 'cipher'] as const;
const BUILD = { gaslight, whisper, redact, cipher };

export const textAlchemyEngine: GimmickEngine = {
  id: 'text-alchemy',
  mount(host, blueprint, props, ctx) {
    injectEngineStyle('text-alchemy', CSS);
    const mode = variantOf(blueprint, props, 'mode', MODES);
    const { root, body } = mountFrame(host, blueprint, ctx, {
      layout: mode,
      label: blueprint.name,
    });
    const cancels: Array<() => void> = [];
    const env: AlchemyEnv = {
      ctx,
      root,
      body,
      initial: propText(props, 'initialText'),
      altered: propText(props, 'alteredText'),
      hint: propText(props, 'hint'),
      cancels,
      onLand: () => ((root.dataset.state = 'done'), cue(ctx, blueprint, props)),
    };
    const run = BUILD[mode](env);
    if (isStill(ctx)) root.dataset.state = 'done';
    ctx.onTierChange(() => {
      run.sync();
      if (isStill(ctx)) root.dataset.state = 'done';
    });
    return {
      async trigger() {
        if (root.dataset.state !== 'done') root.dataset.state = 'playing';
        await run.trigger();
        root.dataset.state = 'done';
      },
      destroy() {
        cancels.splice(0).forEach((f) => f());
        root.remove();
      },
    };
  },
};

export default textAlchemyEngine;
