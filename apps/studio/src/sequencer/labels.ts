import { NOTE_KINDS, type SequenceClip, type SequenceNoteKind, type TrackKind } from '@ie/story';
import { Crosshair, MoveHorizontal, Shield, type LucideIcon } from 'lucide-react';
import type { MessageKey } from '../messages.ts';
import { audioKind } from '../project/factory.ts';
import { stageKind } from '../project/stage-kinds.ts';
import { BLOCK_ICON, blockName, type BlockKind } from '../write/blockInfo.ts';
import type { Snap } from './edit.ts';

export type NoteKindChoice = SequenceNoteKind;
export const NOTE_CHOICES = NOTE_KINDS;

export const NOTE_ICON: Readonly<Record<SequenceNoteKind, LucideIcon>> = {
  parry: Shield,
  dodge: MoveHorizontal,
  strike: Crosshair,
};

export const trackName = (kind: TrackKind): MessageKey => `seq.track.${kind}`;
export const noteName = (kind: SequenceNoteKind): MessageKey => `seq.note.${kind}`;

export const SNAP_NAMES: Readonly<Record<string, MessageKey>> = {
  bar: 'seq.snap.bar',
  '1': 'seq.snap.beat',
  '0.5': 'seq.snap.half',
  '0.25': 'seq.snap.quarter',
  '0.125': 'seq.snap.eighth',
  '0.0625': 'seq.snap.sixteenth',
};
export const snapName = (snap: Snap): MessageKey => SNAP_NAMES[String(snap)] ?? 'seq.snap.beat';

/** A clip as the block it would be: its kind drives the label, the icon and the editor. */
export function clipKind(clip: SequenceClip): BlockKind {
  const block = { id: clip.id, type: 'action' as const, action: clip.action };
  return audioKind(block) ?? stageKind(block) ?? 'action';
}

export function clipIcon(clip: SequenceClip): LucideIcon {
  return BLOCK_ICON[clipKind(clip)];
}

export function clipName(clip: SequenceClip): MessageKey {
  return blockName(clipKind(clip));
}

/** Beats as "bar · beat" for people: both counted from 1. */
export function barBeat(beat: number, beatsPerBar: number): { bar: number; beat: string } {
  const bar = Math.floor(beat / beatsPerBar);
  const within = beat - bar * beatsPerBar + 1;
  return { bar: bar + 1, beat: (Math.round(within * 100) / 100).toString() };
}
