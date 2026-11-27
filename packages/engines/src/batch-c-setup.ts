// Shared harness for the batch-C engine tests (happy-dom): mounts a blueprint with a test context.
import type {
  BlueprintProps,
  EngineInstance,
  EngineTier,
  GimmickBlueprint,
  GimmickEngine,
} from '@kn/core/gimmicks';
import { afterEach, vi } from 'vitest';
import audioBed from './audio-bed/index.ts';
import audioStinger from './audio-stinger/index.ts';
import { BATCH_C } from './blueprints/batch-c.ts';
import marginNote from './margin-note/index.ts';
import particleField from './particle-field/index.ts';
import screenFx from './screen-fx/index.ts';
import { createTestContext, type TestContext } from './shared/test-context.ts';
import spatialLayout from './spatial-layout/index.ts';

export const ENGINES: Record<string, GimmickEngine> = {
  'margin-note': marginNote,
  'spatial-layout': spatialLayout,
  'screen-fx': screenFx,
  'particle-field': particleField,
  'audio-bed': audioBed,
  'audio-stinger': audioStinger,
};
export const EVIL = '<img src=x onerror=alert(1)>';

export const bpOf = (id: string): GimmickBlueprint => {
  const b = BATCH_C.find((x) => x.id === id);
  if (!b) throw new Error(`missing ${id}`);
  return b;
};

export let live: TestContext[] = [];
export function setup(
  id: string,
  tier: EngineTier,
  over: BlueprintProps = {},
  calm = false,
  unlocked = true,
): { t: TestContext; inst: EngineInstance; root: HTMLElement; host: HTMLElement } {
  const bp = bpOf(id);
  const t = createTestContext(tier, 'noir-rain', calm);
  t.setAudioUnlocked(unlocked);
  live.push(t);
  const host = document.createElement('div');
  document.body.append(host);
  const inst = ENGINES[bp.engine]!.mount(host, bp, { ...bp.defaultProps, ...over }, t.ctx);
  return { t, inst, root: host.firstElementChild as HTMLElement, host };
}
afterEach(() => {
  live.forEach((t) => t.dispose());
  live = [];
  document.body.replaceChildren();
});

/** Makes `canvas.getContext('2d')` return a recording fake (happy-dom has none). */
export function fakeCanvas(): Record<string, ReturnType<typeof vi.fn>> {
  const g = {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    fill: vi.fn(),
    ellipse: vi.fn(),
    arc: vi.fn(),
    fillRect: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    g as unknown as CanvasRenderingContext2D,
  );
  return g;
}
