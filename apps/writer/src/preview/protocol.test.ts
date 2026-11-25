import { describe, expect, it } from 'vitest';
import { a11yMessage, lifecycleMessage, parseReaderMessage } from './protocol.ts';

describe('parseReaderMessage', () => {
  it('accepts object and JSON-string forms', () => {
    expect(parseReaderMessage({ type: 'kn-preview-ready' })).toEqual({ type: 'kn-preview-ready' });
    expect(parseReaderMessage(JSON.stringify({ type: 'kn-preview-ready' }))).toEqual({
      type: 'kn-preview-ready',
    });
    expect(parseReaderMessage({ type: 'kn-preview-rendered', chapterId: 'c1' })).toEqual({
      type: 'kn-preview-rendered',
      chapterId: 'c1',
    });
    expect(
      parseReaderMessage(JSON.stringify({ type: 'kn-preview-error', errors: ['a', 1, 'b'] })),
    ).toEqual({ type: 'kn-preview-error', errors: ['a', 'b'] });
    expect(parseReaderMessage({ type: 'kn-preview-error' })).toEqual({
      type: 'kn-preview-error',
      errors: [],
    });
  });

  it('accepts the reading position used to replay scroll after a WebView crash', () => {
    expect(parseReaderMessage({ type: 'kn-preview-position', blockId: 'b9' })).toEqual({
      type: 'kn-preview-position',
      blockId: 'b9',
    });
    expect(parseReaderMessage({ type: 'kn-preview-position' })).toBeNull();
  });

  it('rejects unknown types and garbage', () => {
    expect(parseReaderMessage({ type: 'other' })).toBeNull();
    expect(parseReaderMessage({ type: 'kn-preview-rendered', chapterId: 3 })).toBeNull();
    expect(parseReaderMessage('not json')).toBeNull();
    expect(parseReaderMessage('"str"')).toBeNull();
    expect(parseReaderMessage(null)).toBeNull();
    expect(parseReaderMessage(42)).toBeNull();
    expect(parseReaderMessage(undefined)).toBeNull();
  });
});

describe('host control messages', () => {
  it('builds lifecycle and a11y messages that survive the JSON bridge', () => {
    expect(lifecycleMessage(true)).toEqual({ type: 'lifecycle', state: 'active' });
    expect(lifecycleMessage(false)).toEqual({ type: 'lifecycle', state: 'background' });
    expect(JSON.parse(JSON.stringify(a11yMessage(true)))).toEqual({
      type: 'a11y',
      reducedMotion: true,
    });
  });
});
