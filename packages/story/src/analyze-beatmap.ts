import { objectEnd } from './beatmap.ts';
import type { RhythmBlock, StoryProject, VariableType } from './schema.ts';

type Report = (
  severity: 'error' | 'warning',
  code: string,
  message: string,
  params: Record<string, string>,
  where?: string,
) => void;

/** A Rhythm block plays a beatmap that exists and has something to hit. */
export function checkRhythmBlock(
  block: RhythmBlock,
  project: StoryProject,
  report: Report,
  needVar: (id: string, where: string, type?: VariableType) => void,
): void {
  if (block.score) needVar(block.score, block.id, 'number');
  if (!block.beatmap) {
    report('error', 'rhythm-beatmap', 'A Rhythm block has no beatmap chosen.', {}, block.id);
    return;
  }
  const map = project.beatmaps?.find((b) => b.id === block.beatmap);
  if (!map)
    report(
      'error',
      'unknown-beatmap',
      `A Rhythm block plays a beatmap that doesn't exist ("${block.beatmap}").`,
      { id: block.beatmap },
      block.id,
    );
}

/** Each beatmap: its song exists, it has notes, and its notes and timing are in order. */
export function checkBeatmaps(project: StoryProject, report: Report): void {
  const tracks = new Set((project.audio?.tracks ?? []).map((t) => t.id));
  for (const map of project.beatmaps ?? []) {
    const params = { id: map.id, name: map.name.en ?? map.name.tr ?? map.id };
    if (map.track && !tracks.has(map.track))
      report(
        'error',
        'beatmap-track',
        `The beatmap "${params.name}" plays a song that isn't in the library.`,
        params,
        map.id,
      );
    if (map.objects.length === 0) {
      report(
        'warning',
        'beatmap-empty',
        `The beatmap "${params.name}" has nothing to hit yet.`,
        params,
        map.id,
      );
      continue;
    }
    const outOfOrder = map.objects.some((o, i) => i > 0 && o.t < (map.objects[i - 1]?.t ?? 0));
    const backwards = map.objects.some((o) => objectEnd(o) < o.t);
    const timing = map.timing.some((p, i) => i > 0 && p.t < (map.timing[i - 1]?.t ?? 0));
    if (outOfOrder || backwards || timing)
      report(
        'error',
        'beatmap-order',
        `The beatmap "${params.name}" has notes or tempo changes out of order.`,
        params,
        map.id,
      );
  }
}
