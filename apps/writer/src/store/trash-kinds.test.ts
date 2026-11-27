import { describe, expect, it } from 'vitest';
import { createMemoryDatabase } from '../db/memory-driver.ts';
import { createDoc } from './folders.ts';
import { NovelRepository } from './repository.ts';
import { deletesInLabel, listTrashedItems, moveToTrash, trashHint } from './trash.ts';

describe('Trash kinds and labels', () => {
  it('exposes the doc story kind on trashed docs', async () => {
    const repo = new NovelRepository(createMemoryDatabase());
    const mara = await createDoc(repo, null, { title: 'Mara', kind: 'character' });
    const port = await createDoc(repo, null, { title: 'Port', kind: 'location' });
    const plain = await createDoc(repo, null, { title: 'Plain' });
    for (const d of [mara, port, plain]) await moveToTrash(repo, { kind: 'doc', id: d.id });
    const kinds = new Map((await listTrashedItems(repo)).map((i) => [i.title, i.docKind]));
    expect(kinds.get('Mara')).toBe('character');
    expect(kinds.get('Port')).toBe('location');
    expect(kinds.get('Plain')).toBe('note');
  });

  it('pluralizes the English deletes-in label', () => {
    expect(deletesInLabel(0)).toBe('Deletes today');
    expect(deletesInLabel(1)).toBe('Deletes in 1 day');
    expect(deletesInLabel(12)).toBe('Deletes in 12 days');
    expect(trashHint()).toContain('Trash');
  });
});
