import {
  listKey,
  type Block,
  type ChoiceOption,
  type LocalText,
  type Passage,
  type StoryProject,
} from '@ie/story';

/**
 * Walking and rewriting the block tree. Every function returns the same object when nothing
 * changed, so undo snapshots share everything an edit didn't touch.
 */

type Blocks = readonly Block[];
export type ListMapper = (key: string, list: Blocks) => Blocks;

/** The nested block lists inside a block, with their stack keys (see listKey). */
export function childLists(block: Block): [string, Blocks][] {
  switch (block.type) {
    case 'choice':
      return block.options.map((o) => [listKey.option(o.id), o.then]);
    case 'if':
      return [
        ...block.branches.map((b): [string, Blocks] => [listKey.branch(b.id), b.then]),
        ...(block.else ? [[listKey.else(block.id), block.else] as [string, Blocks]] : []),
      ];
    case 'check':
      return [
        [listKey.success(block.id), block.success],
        [listKey.fail(block.id), block.fail],
      ];
    case 'fight':
    case 'minigame':
      return [
        [listKey.win(block.id), block.win],
        [listKey.lose(block.id), block.lose],
      ];
    case 'random':
      return block.branches.map((b) => [listKey.branch(b.id), b.then]);
    case 'battle':
      return [
        [listKey.win(block.id), block.win],
        [listKey.lose(block.id), block.lose],
        ...(block.fled ? [[listKey.fled(block.id), block.fled] as [string, Blocks]] : []),
      ];
    default:
      return [];
  }
}

function mapChildren(block: Block, map: ListMapper): Block {
  switch (block.type) {
    case 'choice': {
      let changed = false;
      const options = block.options.map((o) => {
        const then = mapList(listKey.option(o.id), o.then, map);
        if (then === o.then) return o;
        changed = true;
        return { ...o, then };
      });
      return changed ? { ...block, options } : block;
    }
    case 'if': {
      let changed = false;
      const branches = block.branches.map((b) => {
        const then = mapList(listKey.branch(b.id), b.then, map);
        if (then === b.then) return b;
        changed = true;
        return { ...b, then };
      });
      const otherwise = block.else && mapList(listKey.else(block.id), block.else, map);
      if (!changed && otherwise === block.else) return block;
      return otherwise ? { ...block, branches, else: otherwise } : { ...block, branches };
    }
    case 'check': {
      const success = mapList(listKey.success(block.id), block.success, map);
      const fail = mapList(listKey.fail(block.id), block.fail, map);
      return success === block.success && fail === block.fail ? block : { ...block, success, fail };
    }
    case 'fight':
    case 'minigame': {
      const win = mapList(listKey.win(block.id), block.win, map);
      const lose = mapList(listKey.lose(block.id), block.lose, map);
      return win === block.win && lose === block.lose ? block : { ...block, win, lose };
    }
    case 'battle': {
      const win = mapList(listKey.win(block.id), block.win, map);
      const lose = mapList(listKey.lose(block.id), block.lose, map);
      const fled = block.fled && mapList(listKey.fled(block.id), block.fled, map);
      if (win === block.win && lose === block.lose && fled === block.fled) return block;
      return fled ? { ...block, win, lose, fled } : { ...block, win, lose };
    }
    case 'random': {
      let changed = false;
      const branches = block.branches.map((b) => {
        const then = mapList(listKey.branch(b.id), b.then, map);
        if (then === b.then) return b;
        changed = true;
        return { ...b, then };
      });
      return changed ? { ...block, branches } : block;
    }
    default:
      return block;
  }
}

/** Applies `map` to a list after its blocks' own lists have been mapped (innermost first). */
function mapList(key: string, list: Blocks, map: ListMapper): Blocks {
  let changed = false;
  const inner = list.map((block) => {
    const next = mapChildren(block, map);
    if (next !== block) changed = true;
    return next;
  });
  return map(key, changed ? inner : list);
}

function mapPassages(project: StoryProject, fn: (p: Passage) => Passage): StoryProject {
  let changed = false;
  const chapters = project.chapters.map((chapter) => {
    let chapterChanged = false;
    const passages = chapter.passages.map((p) => {
      const next = fn(p);
      if (next !== p) chapterChanged = true;
      return next;
    });
    if (!chapterChanged) return chapter;
    changed = true;
    return { ...chapter, passages };
  });
  return changed ? { ...project, chapters } : project;
}

/** Rewrites the block lists of rules and routines (the Logic workspace). */
function mapLogic(project: StoryProject, map: ListMapper): StoryProject {
  let next = project;
  if (project.rules?.length) {
    let changed = false;
    const rules = project.rules.map((rule) => {
      const blocks = mapList(listKey.rule(rule.id), rule.do, map);
      if (blocks === rule.do) return rule;
      changed = true;
      return { ...rule, do: blocks };
    });
    if (changed) next = { ...next, rules };
  }
  if (project.routines?.length) {
    let changed = false;
    const routines = project.routines.map((routine) => {
      const blocks = mapList(listKey.routine(routine.id), routine.blocks, map);
      if (blocks === routine.blocks) return routine;
      changed = true;
      return { ...routine, blocks };
    });
    if (changed) next = { ...next, routines };
  }
  return next;
}

/** Rewrites every block list in the project: passages, rules, routines and every nested one. */
export function mapLists(project: StoryProject, map: ListMapper): StoryProject {
  const passages = mapPassages(project, (passage) => {
    const blocks = mapList(listKey.passage(passage.id), passage.blocks, map);
    return blocks === passage.blocks ? passage : { ...passage, blocks };
  });
  return mapLogic(passages, map);
}

export function updatePassage(
  project: StoryProject,
  id: string,
  fn: (p: Passage) => Passage,
): StoryProject {
  return mapPassages(project, (p) => (p.id === id ? fn(p) : p));
}

export function updateBlock(
  project: StoryProject,
  id: string,
  fn: (b: Block) => Block,
): StoryProject {
  return mapLists(project, (_key, list) => {
    const index = list.findIndex((b) => b.id === id);
    if (index < 0) return list;
    const block = list[index] as Block;
    const next = fn(block);
    return next === block ? list : list.with(index, next);
  });
}

export function updateOption(
  project: StoryProject,
  id: string,
  fn: (o: ChoiceOption) => ChoiceOption,
): StoryProject {
  return mapLists(project, (_key, list) => {
    let changed = false;
    const next = list.map((block) => {
      if (block.type !== 'choice' || !block.options.some((o) => o.id === id)) return block;
      changed = true;
      return { ...block, options: block.options.map((o) => (o.id === id ? fn(o) : o)) };
    });
    return changed ? next : list;
  });
}

export function updateList(
  project: StoryProject,
  key: string,
  fn: (list: Blocks) => Blocks,
): StoryProject {
  return mapLists(project, (k, list) => (k === key ? fn(list) : list));
}

export interface BlockPlace {
  readonly block: Block;
  readonly passageId: string;
  readonly listKey: string;
  readonly index: number;
}

/** Calls `visit` for every block, depth first, in reading order; rule and routine blocks last, with no passage. */
export function walkBlocks(project: StoryProject, visit: (place: BlockPlace) => void): void {
  const walk = (key: string, list: Blocks, passageId: string) => {
    list.forEach((block, index) => {
      visit({ block, passageId, listKey: key, index });
      for (const [childKey, child] of childLists(block)) walk(childKey, child, passageId);
    });
  };
  for (const chapter of project.chapters)
    for (const passage of chapter.passages)
      walk(listKey.passage(passage.id), passage.blocks, passage.id);
  for (const rule of project.rules ?? []) walk(listKey.rule(rule.id), rule.do, '');
  for (const routine of project.routines ?? [])
    walk(listKey.routine(routine.id), routine.blocks, '');
}

export function findBlock(project: StoryProject, id: string): BlockPlace | undefined {
  let found: BlockPlace | undefined;
  walkBlocks(project, (place) => {
    if (!found && place.block.id === id) found = place;
  });
  return found;
}

export function insertBlock(
  project: StoryProject,
  key: string,
  index: number,
  block: Block,
): StoryProject {
  return updateList(project, key, (list) => list.toSpliced(index, 0, block));
}

export function removeBlock(project: StoryProject, id: string): StoryProject {
  return mapLists(project, (_key, list) =>
    list.some((b) => b.id === id) ? list.filter((b) => b.id !== id) : list,
  );
}

/** Moves a block one step up (-1) or down (+1) inside its own list. */
export function moveBlock(project: StoryProject, id: string, delta: -1 | 1): StoryProject {
  return mapLists(project, (_key, list) => {
    const from = list.findIndex((b) => b.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return list;
    const next = [...list];
    [next[from], next[to]] = [next[to] as Block, next[from] as Block];
    return next;
  });
}

/** Every text field inside a block, in display order (the line, a prompt, option texts…). */
export function blockTexts(block: Block): LocalText[] {
  switch (block.type) {
    case 'narration':
    case 'dialogue':
      return [block.text];
    case 'choice':
      return [
        ...(block.prompt ? [block.prompt] : []),
        ...block.options.flatMap((o) => (o.lockedText ? [o.text, o.lockedText] : [o.text])),
      ];
    case 'check':
      return block.label ? [block.label] : [];
    case 'input':
      return [block.prompt];
    case 'exits':
      return block.prompt ? [block.prompt] : [];
    case 'end':
      return block.ending ? [block.ending.title] : [];
    default:
      return [];
  }
}

function replaceText(block: Block, text: LocalText): Block {
  const swap = (t: LocalText): LocalText => (t.id === text.id ? text : t);
  switch (block.type) {
    case 'narration':
    case 'dialogue':
      return block.text.id === text.id ? { ...block, text } : block;
    case 'choice':
      return {
        ...block,
        ...(block.prompt ? { prompt: swap(block.prompt) } : {}),
        options: block.options.map((o) => ({
          ...o,
          text: swap(o.text),
          ...(o.lockedText ? { lockedText: swap(o.lockedText) } : {}),
        })),
      };
    case 'check':
      return block.label ? { ...block, label: swap(block.label) } : block;
    case 'input':
      return { ...block, prompt: swap(block.prompt) };
    case 'exits':
      return block.prompt ? { ...block, prompt: swap(block.prompt) } : block;
    case 'end':
      return block.ending
        ? { ...block, ending: { ...block.ending, title: swap(block.ending.title) } }
        : block;
    default:
      return block;
  }
}

/** Sets one language of a line, wherever the line is. */
export function setLineText(
  project: StoryProject,
  lineId: string,
  locale: 'en' | 'tr',
  value: string,
): StoryProject {
  return mapLists(project, (_key, list) => {
    const index = list.findIndex((b) => blockTexts(b).some((t) => t.id === lineId));
    if (index < 0) return list;
    const block = list[index] as Block;
    const text = blockTexts(block).find((t) => t.id === lineId) as LocalText;
    if (text[locale] === value) return list;
    return list.with(index, replaceText(block, { ...text, [locale]: value }));
  });
}

export function allPassages(project: StoryProject): Passage[] {
  return project.chapters.flatMap((c) => c.passages);
}
