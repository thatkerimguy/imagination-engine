import { listKey, type Block, type StoryProject } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { newRoutine, newRule } from './factory-rpg.ts';
import { cloneBlock, newBlock, newProject } from './factory.ts';
import {
  findBlock,
  insertBlock,
  moveBlock,
  removeBlock,
  setLineText,
  updateBlock,
  walkBlocks,
} from './tree.ts';

function withChoice(): { project: StoryProject; choice: Extract<Block, { type: 'choice' }> } {
  const project = newProject({ en: 'Test', tr: 'Deneme' });
  const choice = newBlock('choice') as Extract<Block, { type: 'choice' }>;
  const passage = project.chapters[0]?.passages[0];
  if (!passage) throw new Error('no passage');
  return { project: insertBlock(project, listKey.passage(passage.id), 1, choice), choice };
}

describe('block tree edits', () => {
  it('inserts into nested lists and finds blocks anywhere', () => {
    const { project, choice } = withChoice();
    const option = choice.options[0];
    if (!option) throw new Error('no option');
    const inner = newBlock('narration');
    const next = insertBlock(project, listKey.option(option.id), 0, inner);
    expect(findBlock(next, inner.id)).toMatchObject({
      listKey: listKey.option(option.id),
      index: 0,
    });
    const ids: string[] = [];
    walkBlocks(next, ({ block }) => ids.push(block.id));
    expect(ids).toEqual([project.chapters[0]?.passages[0]?.blocks[0]?.id, choice.id, inner.id]);
  });

  it('shares everything an edit did not touch', () => {
    const { project, choice } = withChoice();
    const extra = newProject({ en: 'X' }).chapters[0]?.passages[0];
    if (!extra) throw new Error('no passage');
    const twoPassages = {
      ...project,
      chapters: project.chapters.map((c) => ({ ...c, passages: [...c.passages, extra] })),
    };
    const edited = updateBlock(twoPassages, choice.id, (b) => ({ ...b, id: b.id }));
    const passages = edited.chapters[0]?.passages ?? [];
    expect(passages[1]).toBe(extra);
    expect(updateBlock(twoPassages, 'missing', (b) => b)).toBe(twoPassages);
  });

  it('moves and removes blocks within their list', () => {
    const { project, choice } = withChoice();
    const moved = moveBlock(project, choice.id, -1);
    expect(moved.chapters[0]?.passages[0]?.blocks[0]?.id).toBe(choice.id);
    expect(moveBlock(moved, choice.id, -1)).toBe(moved);
    const removed = removeBlock(moved, choice.id);
    expect(findBlock(removed, choice.id)).toBeUndefined();
  });

  it('sets one language of a line wherever it is', () => {
    const { project, choice } = withChoice();
    const line = choice.options[1]?.text;
    if (!line) throw new Error('no line');
    const next = setLineText(project, line.id, 'tr', 'Kaç');
    const found = findBlock(next, choice.id)?.block;
    expect(found?.type === 'choice' && found.options[1]?.text).toEqual({ ...line, tr: 'Kaç' });
    expect(setLineText(next, line.id, 'tr', 'Kaç')).toBe(next);
  });

  it('gives a copied block fresh IDs all the way down', () => {
    const { choice } = withChoice();
    const copy = cloneBlock(choice);
    expect(copy.id).not.toBe(choice.id);
    if (copy.type !== 'choice') throw new Error('not a choice');
    expect(copy.options.map((o) => o.id)).not.toContain(choice.options[0]?.id);
    expect(copy.options[0]?.text.id).not.toBe(choice.options[0]?.text.id);
  });

  it('edits the blocks of rules, routines and battles like any other list', () => {
    const rule = newRule('Rule 1');
    const routine = newRoutine('Routine 1');
    const base = {
      ...newProject({ en: 'Test', tr: 'Deneme' }),
      rules: [rule],
      routines: [routine],
    };
    const battle = newBlock('battle', { enemy: 'rat' });
    const line = newBlock('narration');
    let next = insertBlock(base, listKey.rule(rule.id), 0, battle);
    next = insertBlock(next, listKey.win(battle.id), 0, line);
    next = insertBlock(next, listKey.routine(routine.id), 0, newBlock('narration'));
    const found = next.rules?.[0]?.do[0];
    expect(found?.type === 'battle' && found.win[0]?.id).toBe(line.id);
    expect(next.routines?.[0]?.blocks).toHaveLength(1);
    expect(findBlock(next, line.id)).toMatchObject({
      listKey: listKey.win(battle.id),
      passageId: '',
    });
    const copy = cloneBlock(battle);
    expect(copy.id).not.toBe(battle.id);
    expect(removeBlock(next, line.id).rules?.[0]?.do[0]).toMatchObject({ win: [] });
  });
});
