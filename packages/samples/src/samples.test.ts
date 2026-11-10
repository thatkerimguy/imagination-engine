import { compileStory, ENDINGS_KEY, nextRandom, StoryRuntime } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { samples } from './index.ts';

/** A tiny auto-playtester: random choices, until the story ends. */
function playthrough(seed: number) {
  const story = compileStory(samples.rainAlley);
  const runtime = new StoryRuntime(story, { seed });
  let pick = seed;
  for (let steps = 0; steps < 500; steps++) {
    const beat = runtime.advance().at(-1) ?? runtime.waiting;
    if (!beat || beat.kind === 'end')
      return { runtime, ending: beat?.kind === 'end' ? beat.endingId : undefined };
    if (beat.kind === 'choice') {
      const open = beat.options.filter((o) => o.enabled);
      const roll = nextRandom(pick);
      pick = roll.state;
      runtime.choose(open[Math.floor(roll.value * open.length)]?.id ?? '');
    } else if (beat.kind === 'input') {
      runtime.submit(seed % 2 ? 'Ayşe' : '');
    } else if (beat.kind === 'fight') {
      const roll = nextRandom(pick);
      pick = roll.state;
      runtime.resolveFight({ won: roll.value < 0.5, score: Math.round(roll.value * 100) });
    }
  }
  throw new Error(`Seed ${seed} never reached an ending.`);
}

describe('The Rain Alley sample', () => {
  it('loads without errors or warnings', () => {
    const story = compileStory(samples.rainAlley);
    expect(story.problems).toEqual([]);
    expect(story.project.languages).toEqual(['en', 'tr']);
  });

  it('always reaches an ending, and every ending is reachable', () => {
    const endings = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const { runtime, ending } = playthrough(seed);
      expect(ending).toBeDefined();
      endings.add(ending ?? '');
      expect(runtime.persistentValues[ENDINGS_KEY]).toEqual([ending]);
    }
    expect([...endings].sort()).toEqual([
      'dark',
      'duelist',
      'family',
      'frozen',
      'scar',
      'victory',
      'words',
    ]);
  });
});
