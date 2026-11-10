import { storyProjectSchema } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { BLOCK_MENU, newBlock, newProject } from './factory.ts';

describe('new blocks', () => {
  // A fresh project has no characters, variables, items or enemies, so many new blocks start
  // with nothing chosen. The document must still save and load; analysis reports what's missing.
  it('keep a brand-new project a valid document, whatever is added', () => {
    const doc = newProject({ en: 'X', tr: 'X' }, 'Start');
    const [chapter] = doc.chapters;
    const [passage] = chapter?.passages ?? [];
    if (!chapter || !passage) throw new Error('fixture');
    const invalid = BLOCK_MENU.filter((type) => {
      const withBlock = {
        ...doc,
        chapters: [{ ...chapter, passages: [{ ...passage, blocks: [newBlock(type)] }] }],
      };
      return !storyProjectSchema.safeParse(withBlock).success;
    });
    expect(invalid).toEqual([]);
  });
});
