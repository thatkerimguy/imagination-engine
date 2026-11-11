import type { Block } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { replyingSpeaker } from './dialogue.ts';

const say = (id: string, speaker: string): Block => ({
  id,
  type: 'dialogue',
  speaker,
  text: { id, en: '' },
});
const tell = (id: string): Block => ({ id, type: 'narration', text: { id, en: '' } });

describe('replyingSpeaker', () => {
  it('hands the next line to the other side of the conversation', () => {
    expect(replyingSpeaker([say('a', 'mira'), say('b', 'tomas')], 1)).toBe('mira');
    expect(replyingSpeaker([say('a', 'mira'), tell('n'), say('b', 'tomas')], 2)).toBe('mira');
  });

  it('falls back to narration when no one else is talking', () => {
    expect(replyingSpeaker([say('a', 'mira')], 0)).toBeNull();
    expect(replyingSpeaker([say('a', 'mira'), say('b', 'mira')], 1)).toBeNull();
    expect(replyingSpeaker([{ id: 'e', type: 'end' }, say('b', 'mira')], 1)).toBeNull();
    expect(replyingSpeaker([tell('n')], 0)).toBeNull();
  });
});
