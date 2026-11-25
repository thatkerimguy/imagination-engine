import { describe, expect, it } from 'vitest';
import {
  COVER_TARGET,
  fitInside,
  isThumbName,
  THUMB_TARGET,
  thumbUriForCover,
} from './cover-resize.ts';

describe('fitInside', () => {
  it('downscales a large portrait cover to 1200 × 1800, keeping the aspect', () => {
    expect(fitInside({ width: 4000, height: 6000 }, COVER_TARGET)).toEqual({
      width: 1200,
      height: 1800,
    });
    expect(fitInside({ width: 3000, height: 3000 }, COVER_TARGET)).toEqual({
      width: 1200,
      height: 1200,
    });
  });

  it('limits by the tighter edge for wide images', () => {
    expect(fitInside({ width: 4800, height: 1200 }, COVER_TARGET)).toEqual({
      width: 1200,
      height: 300,
    });
  });

  it('builds 240 × 360 thumbnails', () => {
    expect(fitInside({ width: 1200, height: 1800 }, THUMB_TARGET)).toEqual({
      width: 240,
      height: 360,
    });
    expect(fitInside({ width: 1000, height: 1600 }, THUMB_TARGET)).toEqual({
      width: 225,
      height: 360,
    });
  });

  it('never upscales and rejects bad sizes', () => {
    expect(fitInside({ width: 800, height: 1200 }, COVER_TARGET)).toBeNull();
    expect(fitInside({ width: 1200, height: 1800 }, COVER_TARGET)).toBeNull();
    expect(fitInside({ width: 0, height: 10 }, COVER_TARGET)).toBeNull();
    expect(fitInside({ width: 100000, height: 1 }, THUMB_TARGET)).toEqual({
      width: 240,
      height: 1,
    });
  });
});

describe('thumbUriForCover', () => {
  it('derives the sidecar next to the cover', () => {
    expect(thumbUriForCover('file:///data/covers/ab12.jpg')).toBe(
      'file:///data/covers/ab12.thumb.jpg',
    );
    expect(thumbUriForCover('file:///data/covers/ab12.PNG')).toBe(
      'file:///data/covers/ab12.thumb.jpg',
    );
    expect(thumbUriForCover('file:///data/covers/ab12.thumb.jpg')).toBe(
      'file:///data/covers/ab12.thumb.jpg',
    );
  });

  it('leaves data and remote URIs alone', () => {
    expect(thumbUriForCover('data:image/jpeg;base64,AAAA')).toBe('data:image/jpeg;base64,AAAA');
    expect(thumbUriForCover('https://x/y.jpg')).toBe('https://x/y.jpg');
    expect(isThumbName('ab12.thumb.jpg')).toBe(true);
    expect(isThumbName('ab12.jpg')).toBe(false);
  });
});
