import { createMemoryFileStore } from '@ie/core';
import type { StoryProject, Track } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { audioPaths, syncAudioFiles, type FileRemote, type KnownFiles } from './files.ts';

const track = (id: string, path: string): Track => ({
  id,
  title: id,
  source: { kind: 'file', path },
  license: { code: 'own' },
});

const doc = (tracks: Track[]) => ({ audio: { tracks, sounds: [] } }) as unknown as StoryProject;

function memoryRemote(): FileRemote & { files: Map<string, Blob>; puts: number } {
  const files = new Map<string, Blob>();
  const remote = {
    files,
    puts: 0,
    has: (path: string) => Promise.resolve(files.has(path)),
    get: (path: string) => Promise.resolve(files.get(path) ?? null),
    put: (path: string, data: Blob) => {
      remote.puts++;
      files.set(path, data);
      return Promise.resolve();
    },
  };
  return remote;
}

function memoryKnown(): KnownFiles {
  const set = new Set<string>();
  return {
    has: (p) => Promise.resolve(set.has(p)),
    add: (p) => {
      set.add(p);
      return Promise.resolve();
    },
  };
}

describe('song sync', () => {
  it('lists only stored files, once each', () => {
    const urlTrack: Track = {
      id: 'web',
      title: 'web',
      source: { kind: 'url', url: 'https://example.com/a.mp3' },
      license: { code: 'own' },
    };
    expect(
      audioPaths(doc([track('a', 'audio/a.mp3'), track('b', 'audio/a.mp3'), urlTrack])),
    ).toEqual(['audio/a.mp3']);
  });

  it('uploads what this device has, once', async () => {
    const remote = memoryRemote();
    const local = createMemoryFileStore();
    const known = memoryKnown();
    await local.write('audio/a.mp3', new Blob(['song']));
    const story = doc([track('a', 'audio/a.mp3')]);
    expect(await syncAudioFiles(story, remote, local, known)).toEqual({
      uploaded: 1,
      downloaded: 0,
      missing: 0,
    });
    await syncAudioFiles(story, remote, local, known);
    expect(remote.puts).toBe(1);
  });

  it('downloads what another device synced, and counts what nobody has', async () => {
    const remote = memoryRemote();
    remote.files.set('audio/a.mp3', new Blob(['song']));
    const local = createMemoryFileStore();
    const outcome = await syncAudioFiles(
      doc([track('a', 'audio/a.mp3'), track('b', 'audio/b.mp3')]),
      remote,
      local,
      memoryKnown(),
    );
    expect(outcome).toEqual({ uploaded: 0, downloaded: 1, missing: 1 });
    expect(await (await local.read('audio/a.mp3'))?.text()).toBe('song');
  });
});
