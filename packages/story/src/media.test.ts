import { describe, expect, it } from 'vitest';
import { imageSetSchema, MEDIA_DIM_DEFAULT, mediaView, videoSetSchema } from './media.ts';
import { rememberScene } from './state.ts';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('media actions', () => {
  it('accept https pictures and small inline ones, and nothing else', () => {
    expect(
      imageSetSchema.safeParse({ source: { kind: 'url', url: 'https://x.test/a.jpg' } }).success,
    ).toBe(true);
    expect(imageSetSchema.safeParse({ source: { kind: 'inline', data: PNG } }).success).toBe(true);
    expect(
      imageSetSchema.safeParse({ source: { kind: 'url', url: 'http://x.test/a.jpg' } }).success,
    ).toBe(false);
    expect(
      imageSetSchema.safeParse({ source: { kind: 'url', url: 'javascript:alert(1)' } }).success,
    ).toBe(false);
    expect(
      imageSetSchema.safeParse({
        source: { kind: 'inline', data: 'data:image/svg+xml;base64,PHN2Zz4=' },
      }).success,
    ).toBe(false);
    expect(imageSetSchema.safeParse({ dim: 1 }).success).toBe(false);
    expect(videoSetSchema.safeParse({ url: 'https://x.test/v.mp4', loop: false }).success).toBe(
      true,
    );
  });

  it('resolve the scene to what is behind the text', () => {
    expect(mediaView({})).toEqual({ kind: 'none' });
    let scene = rememberScene({}, 'media.image.set', {
      source: { kind: 'inline', data: PNG },
      dim: 0.3,
    });
    expect(mediaView(scene)).toEqual({ kind: 'image', src: PNG, fit: 'cover', dim: 0.3 });
    // A video covers the picture while it plays; stopping it shows the picture again.
    scene = rememberScene(scene, 'media.video.set', { url: 'https://x.test/v.mp4' });
    expect(mediaView(scene)).toEqual({
      kind: 'video',
      src: 'https://x.test/v.mp4',
      fit: 'cover',
      dim: MEDIA_DIM_DEFAULT,
      loop: true,
    });
    scene = rememberScene(scene, 'media.video.set', {});
    expect(mediaView(scene).kind).toBe('image');
    scene = rememberScene(scene, 'media.image.set', {});
    expect(mediaView(scene)).toEqual({ kind: 'none' });
  });

  it('ignore scene entries that are not valid', () => {
    expect(mediaView({ 'media.image.set': { source: { kind: 'url', url: 'ftp://x' } } })).toEqual({
      kind: 'none',
    });
  });
});
