import { checkAudioAction } from './analyze-audio.ts';
import { checkStageAction } from './analyze-stage.ts';
import type { FightBlock, StoryProject } from './schema.ts';
import { sequenceNotes, trackAllows, type SequenceBlock, type SequenceDef } from './sequence.ts';

type Report = (
  severity: 'error' | 'warning',
  code: string,
  message: string,
  params: Record<string, string>,
  where?: string,
) => void;

const LANGUAGE = { en: 'English', tr: 'Turkish' } as const;

function checkSequence(sequence: SequenceDef, project: StoryProject, report: Report): void {
  for (const locale of project.languages)
    if (!sequence.name[locale]?.trim())
      report(
        'warning',
        'sequence-name',
        `The sequence "${sequence.id}" has no ${LANGUAGE[locale]} name.`,
        { id: sequence.id, locale },
        sequence.id,
      );
  if (sequence.track && !(project.audio?.tracks ?? []).some((t) => t.id === sequence.track))
    report(
      'error',
      'unknown-track',
      `"${sequence.track}" isn't a track.`,
      { id: sequence.track },
      sequence.id,
    );
  for (const track of sequence.tracks) {
    if (track.kind === 'notes') {
      for (const note of track.notes) {
        if (note.at >= sequence.length)
          report(
            'warning',
            'clip-outside',
            'This note starts after the sequence ends.',
            {},
            note.id,
          );
        if (sequence.kind === 'move' && note.kind === 'strike')
          report(
            'error',
            'move-strike',
            'A move is the enemy attacking: its notes are parries and dodges.',
            {},
            note.id,
          );
      }
      continue;
    }
    for (const clip of track.clips) {
      if (!trackAllows(track.kind, clip.action)) {
        report(
          'error',
          'clip-action',
          `A ${track.kind} track can't hold ${clip.action}.`,
          { action: clip.action, track: track.kind },
          clip.id,
        );
        continue;
      }
      if (clip.at >= sequence.length)
        report('warning', 'clip-outside', 'This clip starts after the sequence ends.', {}, clip.id);
      // Clips are action blocks on a timeline, so they are checked exactly like blocks.
      const block = { id: clip.id, type: 'action' as const, action: clip.action };
      const asBlock = clip.params ? { ...block, params: clip.params } : block;
      checkStageAction(asBlock, project, report);
      checkAudioAction(asBlock, project, report);
    }
  }
  if (sequence.kind === 'move' && sequenceNotes(sequence).length === 0)
    report(
      'error',
      'move-empty',
      `The move "${sequence.id}" has no notes.`,
      { id: sequence.id },
      sequence.id,
    );
}

/** Sequences, and the move sequences enemies name. */
export function checkSequences(project: StoryProject, report: Report): void {
  const seen = new Set<string>();
  for (const sequence of project.sequences ?? []) {
    if (seen.has(sequence.id))
      report('error', 'duplicate-id', `The ID "${sequence.id}" is used twice.`, {
        id: sequence.id,
      });
    seen.add(sequence.id);
    checkSequence(sequence, project, report);
  }
  for (const enemy of project.enemies ?? [])
    for (const move of enemy.moves) {
      if (!move.sequence) continue;
      const sequence = project.sequences?.find((s) => s.id === move.sequence);
      if (sequence?.kind !== 'move')
        report(
          'error',
          'unknown-move-sequence',
          `"${move.sequence}" isn't a move sequence.`,
          { id: move.sequence },
          move.id,
        );
    }
}

/** The sequence a Sequence block plays. */
export function checkSequenceBlock(
  block: SequenceBlock,
  project: StoryProject,
  report: Report,
): void {
  const sequence = project.sequences?.find((s) => s.id === block.sequence);
  if (!sequence)
    report(
      'error',
      'unknown-sequence',
      block.sequence ? `"${block.sequence}" isn't a sequence.` : 'This block plays no sequence.',
      { id: block.sequence },
      block.id,
    );
  else if (sequence.kind === 'move')
    report(
      'warning',
      'sequence-move',
      `"${sequence.id}" is a fight move; it plays here without its notes.`,
      { id: sequence.id },
      block.id,
    );
}

/** A fight's chart must be a scene with notes in it. */
export function checkFightChart(block: FightBlock, project: StoryProject, report: Report): void {
  if (!block.chart) return;
  const sequence = project.sequences?.find((s) => s.id === block.chart);
  if (sequence?.kind !== 'scene' || sequenceNotes(sequence).length === 0)
    report(
      'error',
      'unknown-chart',
      `"${block.chart}" isn't a scene sequence with notes.`,
      { id: block.chart },
      block.id,
    );
}
