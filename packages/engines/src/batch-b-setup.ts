// Shared harness for the batch-B engine tests (happy-dom): mounts a blueprint with a test context.
import {
  type BlueprintProps,
  type EngineInstance,
  type EngineTier,
  type GimmickBlueprint,
  type GimmickEngine,
} from '@kn/core/gimmicks';
import { afterEach } from 'vitest';
import { BATCH_B } from './blueprints/batch-b.ts';
import { createTestContext, type TestContext } from './shared/test-context.ts';

export const bpOf = (id: string): GimmickBlueprint => {
  const b = BATCH_B.find((x) => x.id === id);
  if (!b) throw new Error(`missing ${id}`);
  return b;
};
export const EVIL = '<img src=x onerror=alert(1)>';

export let live: TestContext[] = [];
export function setup(
  engine: GimmickEngine,
  id: string,
  tier: EngineTier,
  over: BlueprintProps = {},
  calm = false,
): { t: TestContext; inst: EngineInstance; root: HTMLElement } {
  const bp = bpOf(id);
  const t = createTestContext(tier, 'noir-rain', calm);
  live.push(t);
  const host = document.createElement('div');
  document.body.append(host);
  const inst = engine.mount(host, bp, { ...bp.defaultProps, ...over }, t.ctx);
  return { t, inst, root: host.firstElementChild as HTMLElement };
}
afterEach(() => {
  live.forEach((t) => t.dispose());
  live = [];
  document.body.replaceChildren();
});

export const btnOf = (root: HTMLElement): HTMLButtonElement => root.querySelector('button')!;
export const key = (b: HTMLElement, type: 'keydown' | 'keyup', k: string): void => {
  b.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }));
};
export const ptr = (b: HTMLElement, type: string, x = 0, y = 0): void => {
  b.dispatchEvent(
    new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true }),
  );
};
