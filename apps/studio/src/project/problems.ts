import { analyzeProject, type StoryProblem, type StoryProject } from '@ie/story';
import { allPassages, walkBlocks } from './tree.ts';

export interface LocatedProblem extends StoryProblem {
  /** The passage to open, or null for project-wide problems. */
  readonly passageId: string | null;
  /** The block to scroll to inside that passage. */
  readonly blockId: string | null;
}

/** Where every node lives: options and branches point at the block that holds them. */
function nodeIndex(doc: StoryProject): Map<string, { passageId: string; blockId: string | null }> {
  const index = new Map<string, { passageId: string; blockId: string | null }>();
  for (const passage of allPassages(doc))
    index.set(passage.id, { passageId: passage.id, blockId: null });
  walkBlocks(doc, ({ block, passageId }) => {
    const place = { passageId, blockId: block.id };
    index.set(block.id, place);
    if (block.type === 'choice') for (const o of block.options) index.set(o.id, place);
    if (block.type === 'if' || block.type === 'random')
      for (const b of block.branches) index.set(b.id, place);
  });
  return index;
}

/**
 * Validates the open project and says where each problem is. Runs on the typed document directly
 * (not through the file schema), so a half-filled block reports "no character chosen" instead of
 * hiding every other problem behind one schema error.
 */
export function findProblems(doc: StoryProject): LocatedProblem[] {
  const index = nodeIndex(doc);
  return analyzeProject(doc).problems.map((problem) => {
    const place = problem.where === undefined ? undefined : index.get(problem.where);
    return { ...problem, passageId: place?.passageId || null, blockId: place?.blockId ?? null };
  });
}

/** Problem counts per passage, for the passage list and the Flow map. */
export function problemsByPassage(problems: readonly LocatedProblem[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of problems)
    if (p.passageId) counts.set(p.passageId, (counts.get(p.passageId) ?? 0) + 1);
  return counts;
}
