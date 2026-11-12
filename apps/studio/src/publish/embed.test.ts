import type { StoryProject, Track } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { dataUrl, embedSongs } from './embed.ts';

const fileTrack: Track = {
  id: 'song',
  title: 'Song',
  source: { kind: 'file', path: 'audio/song.wav', mime: 'audio/wav' },
  license: { code: 'own' },
};
const lost: Track = {
  ...fileTrack,
  id: 'lost',
  title: 'Lost',
  source: { kind: 'file', path: 'audio/lost.mp3' },
};
const doc = { audio: { tracks: [fileTrack, lost], sounds: [] } } as unknown as StoryProject;

describe('embedding songs', () => {
  it('writes a data URL', async () => {
    expect(await dataUrl(new Blob(['hi']), 'audio/wav')).toBe('data:audio/wav;base64,aGk=');
  });

  it('turns stored songs into data URL tracks under the same id', async () => {
    const out = await embedSongs(doc, (path) =>
      Promise.resolve(path === 'audio/song.wav' ? new Blob(['abc']) : undefined),
    );
    expect(out.doc.audio?.tracks[0]).toMatchObject({
      id: 'song',
      source: { kind: 'url', url: 'data:audio/wav;base64,YWJj' },
    });
    expect(out.doc.audio?.tracks[1]).toBe(lost);
    expect(out.missing).toEqual(['Lost']);
    expect(out.bytes).toBe(3);
  });

  it('leaves a story without stored songs alone', async () => {
    const plain = { audio: { tracks: [], sounds: [] } } as unknown as StoryProject;
    expect((await embedSongs(plain, () => Promise.resolve(undefined))).doc).toBe(plain);
  });
});
