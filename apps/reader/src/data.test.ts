import { describe, expect, it } from 'vitest';
import { novelsBase } from './data.ts';

describe('novelsBase', () => {
  it('defaults to ./novels/ beside the reader when unset or empty', () => {
    expect(novelsBase()).toBe('./novels/');
    expect(novelsBase('')).toBe('./novels/');
  });

  it('normalizes a custom base to exactly one trailing slash', () => {
    expect(novelsBase('https://api.example.com/novels')).toBe('https://api.example.com/novels/');
    expect(novelsBase('https://api.example.com/novels/')).toBe('https://api.example.com/novels/');
    expect(novelsBase('https://cdn.example.com/books///')).toBe('https://cdn.example.com/books/');
  });

  it('resolves relative and absolute bases the same way the loaders do', () => {
    const page = 'https://reader.example.com/app/';
    const at = (raw: string | undefined, path: string) =>
      new URL(novelsBase(raw) + path, page).href;
    expect(at(undefined, 'index.json')).toBe('https://reader.example.com/app/novels/index.json');
    expect(at('http://127.0.0.1:8787/novels', 'tide/novel.json')).toBe(
      'http://127.0.0.1:8787/novels/tide/novel.json',
    );
  });
});
