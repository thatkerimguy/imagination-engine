import { z } from 'zod';
import { AUDIO_ACTIONS, isAudioAction } from './audio.ts';
import type { ActionBlock, StoryProject } from './schema.ts';

type Report = (
  severity: 'error' | 'warning',
  code: string,
  message: string,
  params: Record<string, string>,
  where?: string,
) => void;

/** Duplicate IDs in the sound library. */
export function checkAudioLibrary(project: StoryProject, report: Report): void {
  const seen = new Set<string>();
  for (const item of [...(project.audio?.tracks ?? []), ...(project.audio?.sounds ?? [])]) {
    if (seen.has(item.id))
      report('error', 'duplicate-id', `The ID "${item.id}" is used twice.`, { id: item.id });
    seen.add(item.id);
  }
}

/** Params of a known audio action, and the tracks and sounds they name. */
export function checkAudioAction(block: ActionBlock, project: StoryProject, report: Report): void {
  if (!isAudioAction(block.action)) return;
  const parsed = AUDIO_ACTIONS[block.action].safeParse(block.params ?? {});
  if (!parsed.success) {
    const detail = z.prettifyError(parsed.error);
    report(
      'error',
      'action-params',
      `The ${block.action} block is incomplete: ${detail}`,
      { action: block.action, detail },
      block.id,
    );
    return;
  }
  const params = parsed.data as { track?: string | null; sound?: string };
  if (params.track && !project.audio?.tracks.some((t) => t.id === params.track))
    report(
      'error',
      'unknown-track',
      `"${params.track}" isn't a track.`,
      { id: params.track },
      block.id,
    );
  if (params.sound !== undefined && !project.audio?.sounds.some((s) => s.id === params.sound))
    report(
      'error',
      'unknown-sound',
      `"${params.sound}" isn't a sound.`,
      { id: params.sound },
      block.id,
    );
}
