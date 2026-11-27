// ×20 leak check for the v2 sandbox: triggers the blueprint `runs` times back to back, disposing
// between runs, then verifies nothing accumulated — no tracked runtime resources, no stray body
// overlays (screen-fx / particle backdrops), and, when bespoke-3d ran, the single shared WebGL
// context reused (≤ 1 created), with GPU geometry/texture counts back to zero.
import type { BlockHost } from '../runtime/block-host.ts';
import { liveRuntimeResources } from '../runtime-context.ts';

interface GlStats {
  contextsCreated: number;
  live: boolean;
  leases: number;
  lost: boolean;
  geometries: number;
  textures: number;
}

const gl = (): GlStats | null =>
  (window as { __knWebglStage?: () => GlStats }).__knWebglStage?.() ?? null;

/** Body children an engine may have left behind (the shared GL canvas is the stage's own). */
const strays = (baseline: number): number =>
  document.body.querySelectorAll(':scope > :not(.kn-stage-gl)').length - baseline;

export function statsLine(baseline = 0): string {
  const s = gl();
  const g = s
    ? `GL contexts made ${s.contextsCreated} · live ${s.live ? 'yes' : 'no'} · leases ${s.leases} · geo ${s.geometries} · tex ${s.textures}${s.lost ? ' · CONTEXT LOST' : ''}`
    : 'GL contexts made 0 · live no';
  return `${g} · overlay nodes ${Math.max(0, strays(baseline))} · runtime ${liveRuntimeResources()}`;
}

export async function runStress(
  runs: number,
  make: () => BlockHost | null,
  report: (line: string) => void,
): Promise<void> {
  const before = gl()?.contextsCreated ?? 0;
  const bodyBase = document.body.querySelectorAll(':scope > :not(.kn-stage-gl)').length;
  for (let i = 1; i <= runs; i++) {
    const host = make();
    if (!host) return report('Fix the props first.');
    report(`Run ${i}/${runs}…`);
    await Promise.race([host.trigger(), new Promise((r) => setTimeout(r, 10000))]);
    host.dispose();
    await new Promise((r) => setTimeout(r, 120));
  }
  await new Promise((r) => setTimeout(r, 150)); // host-side audio ramps disconnect after 80 ms
  const s = gl();
  const created = (s?.contextsCreated ?? 0) - before;
  const clean =
    (s?.leases ?? 0) === 0 &&
    strays(bodyBase) <= 0 &&
    liveRuntimeResources() === 0 &&
    (s?.geometries ?? 0) === 0 &&
    (s?.textures ?? 0) <= 1 &&
    created <= 1;
  report(
    `${clean ? '✅ No leaks' : '❌ Leak suspected'} after ${runs} runs · new GL contexts ${created} · ${statsLine(bodyBase)}`,
  );
}
