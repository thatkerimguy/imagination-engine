import type { ModuleHost } from '../runtime/module-host.ts';
import type { Stage, StageStats } from '../runtime/stage.ts';

export function statsLine(s: StageStats): string {
  return `GL contexts made ${s.contextsCreated} · live ${s.liveContext ? 'yes' : 'no'} · leases ${s.leases} · geo ${s.geometries} · tex ${s.textures} · overlay nodes ${s.overlayChildren}${s.contextLost ? ' · CONTEXT LOST' : ''}`;
}

/**
 * Triggers the current module `runs` times back to back, disposing between runs, then checks
 * that nothing accumulated: no leases or stray overlay DOM, GPU geometry/texture counts back to
 * the level after the first run (three keeps a few renderer-wide singletons such as its PBR
 * lookup table), and the one shared WebGL context reused rather than recreated.
 */
export async function runStress(
  runs: number,
  make: () => ModuleHost | null,
  stage: Stage,
  report: (line: string) => void,
): Promise<void> {
  const before = stage.stats().contextsCreated;
  let baseline: StageStats | null = null;
  for (let i = 1; i <= runs; i++) {
    const host = make();
    if (!host) return report('Fix the props first.');
    report(`Run ${i}/${runs}…`);
    await Promise.race([host.trigger(), new Promise((r) => setTimeout(r, 10000))]);
    host.dispose();
    await new Promise((r) => setTimeout(r, 120));
    baseline ??= stage.stats();
  }
  const s = stage.stats();
  const b = baseline ?? s;
  const created = s.contextsCreated - before;
  const clean =
    s.leases === 0 &&
    s.overlayChildren === 0 &&
    s.geometries <= b.geometries &&
    s.textures <= b.textures &&
    s.geometries === 0 &&
    s.textures <= 1 &&
    created <= 1;
  report(
    `${clean ? '✅ No leaks' : '❌ Leak suspected'} after ${runs} runs · new GL contexts ${created} · ${statsLine(s)}`,
  );
}
