import { describe, expect, it } from 'vitest';
import { legalUrl } from './help-content.ts';

describe('legalUrl', () => {
  it('joins base and page', () => {
    expect(legalUrl('https://api.example.com', 'terms')).toBe(
      'https://api.example.com/legal/terms',
    );
    expect(legalUrl(' https://api.example.com/// ', 'privacy')).toBe(
      'https://api.example.com/legal/privacy',
    );
  });
  it('is empty without a valid base', () => {
    expect(legalUrl('', 'takedown')).toBe('');
    expect(legalUrl('ftp://x', 'terms')).toBe('');
    expect(legalUrl('nonsense', 'terms')).toBe('');
  });
});
