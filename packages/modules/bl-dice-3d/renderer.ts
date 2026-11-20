// Tier orchestration only. three.js and cannon-es live behind the dynamic import of ./high.ts,
// so lite and reduced readers never download them.
import type { ModuleRenderer, RendererContext } from '@kn/core/renderer';
import { pickOutcome } from './faces.ts';
import { renderResultChip, waitForThrow } from './inline.ts';
import { LiteDice } from './lite.ts';
import { retainStyles } from './styles.ts';
import type { DiceProps } from './schema.ts';
import type { HighDice } from './high.ts';

export default function createRenderer(): ModuleRenderer<DiceProps> {
  let ctx: RendererContext<DiceProps> | null = null;
  let high: HighDice | null = null;
  let lite: LiteDice | null = null;
  let releaseStyles: (() => void) | null = null;
  let fellBack = false;

  const begin = (c: RendererContext<DiceProps>): void => {
    ctx = c;
    releaseStyles = retainStyles();
  };

  const showResult = (values: number[], animate: boolean): void => {
    if (ctx && !ctx.signal.aborted) renderResultChip(ctx.host, values, ctx.props.material, animate);
  };

  return {
    async mount(c) {
      begin(c);
      if (c.tier !== 'high') return;
      try {
        const [lease, mod] = await Promise.all([c.stage.acquireGL(), import('./high.ts')]);
        if (c.signal.aborted) return lease.release();
        high = new mod.HighDice(lease, c.props, c.audio);
      } catch (err) {
        // No WebGL (or a lost context): the lite tier still tells the story.
        console.warn('[bl-dice-3d] WebGL unavailable, using lite tier', err);
        fellBack = true;
      }
    },
    reducedMotionFallback(c) {
      begin(c);
    },
    async trigger() {
      const c = ctx;
      if (!c) return;
      if (c.props.trigger === 'tap-or-shake') await waitForThrow(c.host, c.signal);
      if (c.signal.aborted) return;
      if (c.tier === 'reduced') {
        const values = pickOutcome(c.props.outcomeMode, c.props.scriptedNumbers, c.props.count);
        return showResult(values, false);
      }
      if (high && !fellBack) return high.play((v) => showResult(v, true));
      lite = new LiteDice(c.stage.overlay, c.props, c.audio);
      return lite.play((v) => showResult(v, true));
    },
    dispose() {
      high?.dispose();
      lite?.dispose();
      high = lite = null;
      ctx?.host.replaceChildren();
      releaseStyles?.();
      releaseStyles = null;
      ctx = null;
    },
  };
}
