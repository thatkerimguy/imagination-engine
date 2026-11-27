// One timed beat shared by frame-hud and artifact-doc: idle -> playing -> done, one pending
// trigger promise, instant finish on tier downgrade / Calm Mode, idempotent destroy.
import type { EngineInstance, EngineRuntimeContext } from '@kn/core/gimmicks';
import { isStill } from '../shared/kit.ts';

const noop = (): void => undefined;

export function createBeat(
  ctx: EngineRuntimeContext,
  root: HTMLElement,
  duration: () => number,
  land: () => void,
): EngineInstance {
  let run: Promise<void> | null = null;
  let settle: (() => void) | null = null;
  let cancel: () => void = noop;

  const finish = (silent: boolean): void => {
    cancel();
    cancel = noop;
    if (root.dataset.state !== 'done') {
      root.dataset.state = 'done';
      if (!silent) land();
    }
    const s = settle;
    settle = null;
    s?.();
  };

  if (isStill(ctx)) root.dataset.state = 'done';
  ctx.onTierChange(() => isStill(ctx) && finish(true));
  ctx.onPause(() => root.setAttribute('data-paused', ''));
  ctx.onResume(() => root.removeAttribute('data-paused'));

  return {
    trigger() {
      if (isStill(ctx) || root.dataset.state === 'done') {
        finish(true);
        return Promise.resolve();
      }
      if (run) return run;
      root.dataset.state = 'playing';
      void root.offsetWidth;
      run = new Promise<void>((resolve) => {
        settle = resolve;
        cancel = ctx.timeout(() => finish(false), duration());
      });
      return run;
    },
    destroy() {
      cancel();
      cancel = noop;
      settle?.();
      settle = null;
      root.remove();
    },
  };
}
