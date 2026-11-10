import type { StoryProject } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { newProject } from '../project/factory.ts';
import { syncOnce } from './engine.ts';
import type { SyncRemote } from './remote.ts';

/** An in-memory store with the same guarded writes as the real ones. */
function memoryRemote(): SyncRemote & { copy: StoryProject | null; version: number } {
  return {
    copy: null,
    version: 0,
    list() {
      return Promise.resolve([]);
    },
    get() {
      return Promise.resolve(this.copy ? { doc: this.copy, etag: String(this.version) } : null);
    },
    put(doc, etag) {
      const current = this.copy ? String(this.version) : null;
      if (etag !== current) return Promise.resolve(null);
      this.copy = structuredClone(doc);
      this.version++;
      return Promise.resolve(String(this.version));
    },
  };
}

const retitle = (doc: StoryProject, en: string): StoryProject => ({
  ...doc,
  title: { ...doc.title, en },
});
const withAuthor = (doc: StoryProject, author: string): StoryProject => ({ ...doc, author });

describe('device sync', () => {
  it('pushes the first copy, then finds nothing to do', async () => {
    const remote = memoryRemote();
    const doc = newProject({ en: 'Rain', tr: 'Yağmur' }, 'Start');
    const first = await syncOnce(remote, doc, null);
    expect(first.kind).toBe('pushed');
    expect(remote.copy).toEqual(doc);
    expect((await syncOnce(remote, doc, first.base)).kind).toBe('same');
  });

  it('pulls what another device wrote and merges edits from both', async () => {
    const remote = memoryRemote();
    const start = newProject({ en: 'Rain', tr: 'Yağmur' }, 'Start');
    const phone = await syncOnce(remote, start, null);

    // The desktop pulls, then both edit different things.
    const desktop = await syncOnce(remote, structuredClone(start), null);
    const fromDesktop = await syncOnce(remote, retitle(desktop.doc, 'Night rain'), desktop.base);
    expect(fromDesktop.kind).toBe('pushed');

    const fromPhone = await syncOnce(remote, withAuthor(phone.doc, 'K'), phone.base);
    expect(fromPhone.kind).toBe('merged');
    expect(fromPhone.doc.title.en).toBe('Night rain');
    expect(fromPhone.doc.author).toBe('K');
    expect(remote.copy).toEqual(fromPhone.doc);

    // The desktop then simply pulls the merge.
    const back = await syncOnce(remote, fromDesktop.doc, fromDesktop.base);
    expect(back.kind).toBe('pulled');
    expect(back.doc.author).toBe('K');
  });

  it('keeps this device’s value when both changed the same thing', async () => {
    const remote = memoryRemote();
    const start = newProject({ en: 'Rain', tr: 'Yağmur' }, 'Start');
    const a = await syncOnce(remote, start, null);
    await syncOnce(remote, retitle(start, 'Theirs'), a.base);
    const mine = await syncOnce(remote, retitle(start, 'Mine'), a.base);
    expect(mine.doc.title.en).toBe('Mine');
    expect(mine.conflicts).toEqual(['/title/en']);
  });

  it('starts again when another device writes in between', async () => {
    const remote = memoryRemote();
    const start = newProject({ en: 'Rain', tr: 'Yağmur' }, 'Start');
    const a = await syncOnce(remote, start, null);
    const get = remote.get.bind(remote);
    let raced = false;
    remote.get = async (id) => {
      const copy = await get(id);
      if (!raced && copy) {
        raced = true;
        remote.copy = withAuthor(start, 'Other');
        remote.version++;
      }
      return copy;
    };
    const result = await syncOnce(remote, retitle(start, 'Mine'), a.base);
    expect(result.doc.author).toBe('Other');
    expect(result.doc.title.en).toBe('Mine');
  });
});
