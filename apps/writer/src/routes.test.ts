import { describe, expect, it } from 'vitest';
import { appLinkRedirect, folderHref, parentHref, routes, tabForPath } from './routes.ts';

describe('parentHref', () => {
  it('has no parent for the bookshelf', () => {
    expect(parentHref('/', {})).toBeNull();
  });
  it('walks the Book → Chapter hierarchy', () => {
    expect(parentHref('/novel/n1', {})).toBe('/');
    expect(parentHref('/novel/n1/settings', {})).toBe('/novel/n1');
    expect(parentHref(routes.chapter('n1', 's1', 'c1'), {})).toBe('/novel/n1');
  });
  it('returns from preview to its chapter', () => {
    expect(parentHref('/preview', { novel: 'n1', season: 's1', chapter: 'c1' })).toBe(
      routes.chapter('n1', 's1', 'c1'),
    );
    expect(parentHref('/preview', {})).toBe('/');
  });
  it('sends other screens to the shelf', () => {
    expect(parentHref('/settings', {})).toBe('/');
    expect(parentHref('/new-novel', {})).toBe('/');
  });
});

describe('workspace routes', () => {
  it('treats the three tab roots as roots', () => {
    expect(parentHref('/folders', {})).toBeNull();
    expect(parentHref('/search', {})).toBeNull();
  });
  it('walks nested folders and notes back up', () => {
    expect(parentHref('/folders/f2', { parent: 'f1' })).toBe('/folders/f1');
    expect(parentHref(folderHref('f1', null), {})).toBe('/folders');
    expect(parentHref('/folders/note/d1', { folder: 'f1' })).toBe('/folders/f1');
    expect(parentHref(routes.note('d1'), {})).toBe('/folders');
  });
  it('returns compilers, doctor and lock to their owners', () => {
    expect(parentHref(routes.compile('n1'), {})).toBe('/novel/n1');
    expect(parentHref('/compile-folder', { folder: 'f1' })).toBe('/folders/f1');
    expect(parentHref(routes.doctor, {})).toBe('/settings');
    expect(parentHref(routes.lock, {})).toBe('/settings');
    expect(parentHref(routes.settingsBackup, {})).toBe('/settings');
    expect(parentHref(routes.settingsPublishing, {})).toBe('/settings');
  });
  it('deep-links a chapter at a block', () => {
    expect(routes.chapter('n', 's', 'c', 'B1')).toBe('/novel/n/chapter/s/c?block=B1');
  });
  it('shows the tab bar only on tab screens', () => {
    expect(tabForPath('/')).toBe('library');
    expect(tabForPath('/folders')).toBe('notes');
    expect(tabForPath('/folders/f1')).toBe('notes');
    expect(tabForPath('/folders/note/d1')).toBeNull();
    expect(tabForPath('/search')).toBe('search');
    expect(tabForPath('/novel/n1')).toBeNull();
  });
});

describe('appLinkRedirect (Android App Links)', () => {
  it('routes share links to the /open landing', () => {
    expect(appLinkRedirect('https://read.example.app/share/chrome-tide')).toBe(
      routes.openLink('chrome-tide'),
    );
    expect(appLinkRedirect('/r/chrome-tide/')).toBe('/open?novel=chrome-tide');
  });
  it('sends malformed share links to the Library', () => {
    expect(appLinkRedirect('https://read.example.app/share/')).toBe('/');
    expect(appLinkRedirect('https://read.example.app/share/..%2Fx')).toBe('/');
    expect(appLinkRedirect('/r/UPPER')).toBe('/');
  });
  it('leaves every other path alone', () => {
    expect(appLinkRedirect('/novel/n1')).toBeNull();
    expect(appLinkRedirect('/settings')).toBeNull();
    expect(appLinkRedirect('https://read.example.app/share/a/b')).toBeNull();
  });
});
