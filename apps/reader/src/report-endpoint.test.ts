import { describe, expect, it } from 'vitest';
import { deriveReportEndpoint } from './report-endpoint.ts';

describe('deriveReportEndpoint', () => {
  it('prefers the explicit URL', () => {
    expect(deriveReportEndpoint('https://x.test/r', 'https://a.test/novels/')).toBe(
      'https://x.test/r',
    );
  });
  it('derives from an absolute /novels/ base', () => {
    expect(deriveReportEndpoint(undefined, 'http://127.0.0.1:8787/novels/')).toBe(
      'http://127.0.0.1:8787/api/reports',
    );
  });
  it('returns null for relative, non-novels, or missing bases', () => {
    expect(deriveReportEndpoint(undefined, './novels/')).toBeNull();
    expect(deriveReportEndpoint(undefined, 'https://a.test/books/')).toBeNull();
    expect(deriveReportEndpoint('', undefined)).toBeNull();
  });
});
