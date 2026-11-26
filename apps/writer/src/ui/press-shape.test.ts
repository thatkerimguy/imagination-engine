import { describe, expect, it } from 'vitest';
import { boundedRipple, circleBox, clipped, withClip, CARD_RADIUS } from './press-shape.ts';
import { radius } from './tokens.ts';

describe('press shape', () => {
  it('clips a card and a button surface to their own radius', () => {
    expect(clipped(CARD_RADIUS)).toEqual({ borderRadius: radius.md, overflow: 'hidden' });
    expect(clipped(radius.sm)).toEqual({ borderRadius: radius.sm, overflow: 'hidden' });
  });

  it('makes icon buttons a centered clipped circle', () => {
    const c = circleBox(44);
    expect(c).toEqual({ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' });
  });

  it('uses a bounded (non-borderless) ripple', () => {
    expect(boundedRipple('#abc')).toEqual({ color: '#abc', borderless: false });
  });

  it('Press adds overflow hidden only when a radius is set and overflow is unspecified', () => {
    expect(withClip({ borderRadius: 10 })).toEqual({ overflow: 'hidden' });
    expect(withClip({ borderRadius: 10, overflow: 'visible' })).toBeNull();
    expect(withClip({ height: 4 })).toBeNull();
    expect(withClip(undefined)).toBeNull();
  });
});
