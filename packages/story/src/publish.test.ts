import { describe, expect, it } from 'vitest';
import type { Track } from './audio.ts';
import { compileStory } from './compile.ts';
import type { StoryProject } from './project.ts';
import { applyPublicFallbacks, buildCredits, publicBuild, publishCheck } from './publish.ts';

const tracks: Track[] = [
  {
    id: 'mine',
    title: 'My Spotify song',
    source: { kind: 'spotify', uri: 'spotify:track:abc123' },
    publicFallback: 'free',
  },
  {
    id: 'free',
    title: 'Night Drive',
    artist: 'Ada',
    source: { kind: 'url', url: 'https://example.com/a.mp3', provider: 'jamendo' },
    license: { code: 'cc-by-4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  },
  {
    id: 'nd',
    title: 'Locked tune',
    artist: 'Bo',
    source: { kind: 'url', url: 'https://example.com/b.mp3' },
    license: { code: 'cc-by-nd-4.0' },
  },
  { id: 'tube', title: 'Clip', source: { kind: 'youtube', videoId: 'dQw4w9WgXcQ' } },
  {
    id: 'nc',
    title: 'Café',
    source: { kind: 'file', path: 'cafe.mp3' },
    license: { code: 'cc-by-nc-sa-3.0' },
  },
];

const project = (audio: Track[]): StoryProject => ({
  format: 'imagination.story',
  schemaVersion: 1,
  id: 'pub',
  title: { en: 'Pub', tr: 'Pub' },
  languages: ['en', 'tr'],
  start: 'start',
  variables: [],
  characters: [],
  chapters: [
    {
      id: 'c',
      title: { en: 'C', tr: 'C' },
      passages: [{ id: 'start', blocks: [{ id: 'e', type: 'end' }] }],
    },
  ],
  audio: { tracks: audio, sounds: [] },
});

const codes = (p: StoryProject, target: 'public' | 'private') =>
  publishCheck(p, compileStory(p), target).items.map(
    (i) => `${i.severity}:${i.code}:${i.params.track ?? ''}`,
  );

describe('publish check', () => {
  it('blocks private sources and no-derivatives music in a public build', () => {
    const p = project(tracks);
    const check = publishCheck(p, compileStory(p), 'public');
    expect(check.ok).toBe(false);
    expect(codes(p, 'public')).toEqual([
      'block:music-no-derivatives:Locked tune',
      'block:music-private-source:Clip',
      'warn:music-non-commercial:Café',
      'warn:music-share-alike:Café',
      'warn:music-no-attribution:Café',
    ]);
  });

  it('lets a private build use anything', () => {
    const p = project(tracks);
    expect(publishCheck(p, compileStory(p), 'private').ok).toBe(true);
  });

  it('swaps in public fallbacks under the same id', () => {
    const swapped = applyPublicFallbacks(project(tracks)).audio?.tracks ?? [];
    expect(swapped[0]).toMatchObject({ id: 'mine', title: 'Night Drive', source: { kind: 'url' } });
    expect(swapped[0]?.publicFallback).toBeUndefined();
  });

  it('drops stand-in tracks from a public build', () => {
    const ids = (publicBuild(project(tracks)).audio?.tracks ?? []).map((t) => t.id);
    expect(ids).toEqual(['mine', 'nd', 'tube', 'nc']);
  });

  it('flags a fallback that points nowhere', () => {
    const p = project([{ ...tracks[0]!, publicFallback: 'gone' }]);
    expect(codes(p, 'public')).toContain('block:music-bad-fallback:My Spotify song');
  });

  it('credits the music a build plays, once, then the fonts', () => {
    const credits = buildCredits(project(tracks));
    const music = credits.filter((c) => c.kind === 'music').map((c) => c.title);
    expect(music).toEqual(['Night Drive', 'Locked tune', 'Café']);
    expect(credits.find((c) => c.title === 'Night Drive')).toMatchObject({
      by: 'Ada',
      license: 'cc-by-4.0',
    });
    expect(credits.filter((c) => c.kind === 'font')).toHaveLength(3);
  });
});
