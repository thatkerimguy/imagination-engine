// Book Compiler text for the Milestone 4 pack: transcript + summary lines per gimmick.
import type { ModuleBlock } from '@kn/core';
import { describe, expect, it } from 'vitest';
import { getWriterModule } from '../modules/registry.ts';
import { gimmickLines } from './gimmick-text.ts';

const block = (moduleId: string, props: Record<string, unknown> = {}): ModuleBlock => ({
  id: '01HZZZZZZZZZZZZZZZZZZZZZZZ',
  kind: 'module',
  moduleId,
  moduleVersion: 1,
  props: { ...getWriterModule(moduleId)!.schema.defaults, ...props },
});

describe('gimmickLines for gimmick pack 1', () => {
  it('prints the gaslit passage, then its rewrite as a cue', () => {
    expect(gimmickLines(block('pt-gaslight-edit'), 'transcript')).toEqual([
      { text: 'The hallway light was still on when I locked the door.' },
      {
        text: 'On a second look it reads: “The hallway light was already off when I unlocked the door.”',
        italic: true,
      },
    ]);
  });

  it('prints the surface line with the ghost line beneath it', () => {
    const lines = gimmickLines(block('gits-ghost-whisper'), 'transcript');
    expect(lines[0]).toEqual({ text: 'Routine telemetry check. All ports nominal.' });
    expect(lines[1]?.text).toBe(
      'Beneath it, a ghost line: “Someone is riding behind your optic nerve.”',
    );
  });

  it('reads the lighter as a stage direction', () => {
    const name = getWriterModule('bl-lighter-flick')!.meta.name;
    expect(gimmickLines(block('bl-lighter-flick'), 'transcript')).toEqual([
      { text: `${name} flicks alight.`, italic: true },
    ]);
    expect(
      gimmickLines(block('bl-lighter-flick', { action: 'extinguish' }), 'transcript')[0]?.text,
    ).toBe(`${name} snaps shut.`);
  });

  it('summaries are one bracketed line from the card; omit prints nothing', () => {
    for (const id of ['pt-gaslight-edit', 'gits-ghost-whisper', 'bl-lighter-flick']) {
      const [line, ...rest] = gimmickLines(block(id), 'summary');
      expect(rest).toEqual([]);
      expect(line?.text).toMatch(new RegExp(`^\\[${getWriterModule(id)!.meta.name}: .+\\]$`));
      expect(gimmickLines(block(id), 'omit')).toEqual([]);
    }
  });
});
