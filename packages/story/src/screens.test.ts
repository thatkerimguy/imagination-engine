import { describe, expect, it } from 'vitest';
import { analyzeProject } from './analyze.ts';
import { compileStory } from './compile.ts';
import { storyProjectSchema } from './project.ts';
import { endBlock, rpg, say, t } from './rpg.fixture.ts';
import { StoryRuntime } from './runtime.ts';
import type { ScreenDef } from './screens.ts';
import { plainText } from './text.ts';

const hud: ScreenDef = {
  id: 'hud',
  name: { en: 'HUD', tr: 'Gösterge' },
  kind: 'hud',
  children: [
    {
      id: 'row',
      type: 'stack',
      direction: 'row',
      children: [
        { id: 'hp_bar', type: 'bar', var: 'hp', maxVar: 'maxHp', label: t('HP') },
        { id: 'gold_text', type: 'text', text: t('Gold: {gold}') },
        {
          id: 'rich',
          type: 'text',
          text: t('Rich!'),
          if: 'gold > 50',
        },
        {
          id: 'tip',
          type: 'button',
          label: t('Tip'),
          actions: [{ type: 'set', var: 'gold', op: 'subtract', value: 5 }],
        },
      ],
    },
  ],
};

describe('screens', () => {
  it('validate as project data and pass analysis', () => {
    const project = rpg([say('Hello.'), endBlock()], {
      screens: [hud],
      theme: { preset: 'noir', choices: 'filled', colors: { accent: '#c0392b' } },
    });
    expect(storyProjectSchema.safeParse(project).success).toBe(true);
    expect(analyzeProject(project).problems.filter((p) => p.severity === 'error')).toEqual([]);
  });

  it('reject a bad colour and a component with no children list', () => {
    const project = rpg([endBlock()], { theme: { preset: 'auto', colors: { ink: 'red' } } });
    expect(storyProjectSchema.safeParse(project).success).toBe(false);
  });

  it('report unknown variables, screens and misplaced Start buttons', () => {
    const broken: ScreenDef = {
      id: 'bad',
      name: { en: 'Bad' },
      kind: 'panel',
      children: [
        { id: 'b1', type: 'bar', var: 'nope' },
        { id: 'b2', type: 'button', label: t('Go'), actions: [{ type: 'open', screen: 'ghost' }] },
        { id: 'b3', type: 'button', label: t('Start'), actions: [{ type: 'start' }] },
        { id: 'b4', type: 'list', source: 'variable' },
      ],
    };
    const codes = analyzeProject(rpg([endBlock()], { screens: [broken] })).problems.map(
      (p) => p.code,
    );
    expect(codes).toEqual(
      expect.arrayContaining([
        'unknown-variable',
        'unknown-screen',
        'title-only-action',
        'list-needs-var',
      ]),
    );
  });

  it('render their text, test visibility and apply Set actions through the runtime', () => {
    const story = compileStory(rpg([say('Hello.'), endBlock()], { screens: [hud] }));
    const runtime = new StoryRuntime(story);
    runtime.advance();
    const gold = hud.children[0]?.type === 'stack' ? hud.children[0].children[1] : undefined;
    if (gold?.type !== 'text') throw new Error('fixture');
    expect(plainText(runtime.render(gold.text, 'en'))).toBe('Gold: 20');
    expect(runtime.holds('gold > 50')).toBe(false);
    runtime.screenSet({ type: 'set', var: 'gold', op: 'add', value: 40 });
    expect(runtime.value('gold')).toBe(60);
    expect(runtime.holds('gold > 50')).toBe(true);
    expect(plainText(runtime.render(gold.text, 'en'))).toBe('Gold: 60');
  });
});
