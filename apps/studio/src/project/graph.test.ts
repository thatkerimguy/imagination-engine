import { samples } from '@ie/samples';
import { storyProjectSchema, type StoryProject } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { buildFlow } from './graph.ts';
import { findProblems } from './problems.ts';

const rainAlley = storyProjectSchema.parse(samples.rainAlley) as StoryProject;

describe('flow map', () => {
  it('lays passages out by distance from the start', () => {
    const flow = buildFlow(rainAlley);
    const start = flow.nodes.find((n) => n.id === rainAlley.start);
    expect(start).toMatchObject({ column: 0, row: 0, unreached: false });
    expect(flow.nodes).toHaveLength(rainAlley.chapters.flatMap((c) => c.passages).length);
    // Every edge goes to a passage that exists and carries the option text when it has one.
    expect(flow.edges.length).toBeGreaterThan(0);
    expect(flow.edges.some((e) => e.via === 'option' && e.label !== null)).toBe(true);
    for (const node of flow.nodes) expect(node.unreached).toBe(false);
  });

  it('puts passages nothing leads to in a last column', () => {
    const lonely = {
      ...rainAlley,
      chapters: rainAlley.chapters.map((c, i) =>
        i === 0 ? { ...c, passages: [...c.passages, { id: 'lonely', blocks: [] }] } : c,
      ),
    };
    const flow = buildFlow(lonely);
    expect(flow.nodes.find((n) => n.id === 'lonely')).toMatchObject({
      unreached: true,
      column: flow.columns - 1,
    });
  });
});

describe('problems', () => {
  it('finds none in the sample and locates new ones', () => {
    expect(findProblems(rainAlley).filter((p) => p.severity === 'error')).toEqual([]);
    const broken = {
      ...rainAlley,
      chapters: rainAlley.chapters.map((c, i) =>
        i === 0
          ? {
              ...c,
              passages: c.passages.map((p, j) =>
                j === 0
                  ? { ...p, blocks: [...p.blocks, { id: 'jx', type: 'jump' as const, to: '' }] }
                  : p,
              ),
            }
          : c,
      ),
    };
    const problem = findProblems(broken).find((p) => p.code === 'unknown-passage');
    expect(problem).toMatchObject({
      passageId: rainAlley.chapters[0]?.passages[0]?.id,
      blockId: 'jx',
    });
  });
});
