import {
  analyzeProject,
  compileStory,
  nextRandom,
  StoryRuntime,
  type StoryProject,
} from '@ie/story';
import { describe, expect, it } from 'vitest';
import { KITS, applyKit, createFromKit, findKit } from './index.ts';

const options = {
  id: 'n1',
  title: { en: 'Test', tr: 'Deneme' },
  languages: ['en', 'tr'] as const,
};

/** Random choices until the story ends; returns the ending reached. */
function playthrough(project: StoryProject, seed: number): string | undefined {
  const runtime = new StoryRuntime(compileStory(project), { seed });
  let pick = seed;
  for (let steps = 0; steps < 300; steps++) {
    const beat = runtime.advance().at(-1) ?? runtime.waiting;
    if (!beat) return undefined;
    if (beat.kind === 'end') return beat.endingId;
    if (beat.kind === 'choice') {
      const open = beat.options.filter((o) => o.enabled);
      const roll = nextRandom(pick);
      pick = roll.state;
      runtime.choose(open[Math.floor(roll.value * open.length)]?.id ?? '');
    }
  }
  throw new Error(`Seed ${seed} never reached an ending.`);
}

describe('starter kits', () => {
  it('ship the four kits the plan names, each with a title and blurb in both languages', () => {
    expect(KITS.map((k) => k.id)).toEqual(['visual-novel', 'gamebook', 'chat', 'mystery']);
    for (const kit of KITS) {
      expect(kit.name.en && kit.name.tr).toBeTruthy();
      expect(kit.blurb.en && kit.blurb.tr).toBeTruthy();
    }
  });

  for (const kit of KITS) {
    describe(kit.id, () => {
      const project = createFromKit(kit, { ...options, theme: kit.theme });

      it('builds a project with the kit’s look and no problems at all', () => {
        expect(project.theme).toEqual({ preset: kit.theme });
        expect(project.layout).toBe(kit.layout);
        expect(project.kits).toEqual([kit.id]);
        expect(analyzeProject(project).problems).toEqual([]);
      });

      it('always reaches an ending, and every ending is reachable', () => {
        const declared = new Set<string>();
        for (const info of compileStory(project).blocks.values())
          if (info.block.type === 'end' && info.block.ending) declared.add(info.block.ending.id);
        const reached = new Set<string>();
        for (let seed = 1; seed <= 200; seed++) {
          const ending = playthrough(project, seed);
          expect(ending).toBeDefined();
          reached.add(ending ?? '');
        }
        expect([...reached].sort()).toEqual([...declared].sort());
      });
    });
  }

  it('make independent projects (no shared objects between two creations)', () => {
    const kit = findKit('mystery');
    if (!kit) throw new Error('mystery kit');
    const a = createFromKit(kit, { ...options, theme: 'noir' });
    const b = createFromKit(kit, { ...options, id: 'n2', theme: 'paper' });
    expect(a.chapters).not.toBe(b.chapters);
    expect(b.theme).toEqual({ preset: 'paper' });
  });

  it('mix into an existing project without touching its story or definitions', () => {
    const vn = findKit('visual-novel');
    const mystery = findKit('mystery');
    if (!vn || !mystery) throw new Error('kits');
    const base = createFromKit(vn, { ...options, theme: 'night' });
    const mixed = applyKit(base, mystery);
    expect(mixed.chapters).toBe(base.chapters);
    expect(mixed.start).toBe('platform');
    expect(mixed.theme).toEqual(base.theme);
    expect(mixed.kits).toEqual(['visual-novel', 'mystery']);
    expect(mixed.items?.map((i) => i.id)).toEqual(['clue_boots', 'clue_letter', 'clue_key']);
    // Both kits have a title screen with the same id: the project keeps its own.
    expect(mixed.screens?.filter((s) => s.id === 'title')).toHaveLength(1);
    expect(mixed.screens?.map((s) => s.id)).toEqual(['title', 'endings', 'hud', 'journal']);
    expect(applyKit(mixed, mystery)).toEqual(mixed);
    expect(analyzeProject(mixed).problems.filter((p) => p.severity === 'error')).toEqual([]);
  });
});
