import { createTranslator } from '@ie/i18n';
import { compileStory, StoryRuntime, type ScreenComponent, type StoryProject } from '@ie/story';
import { describe, expect, it } from 'vitest';
import { presentMessages } from './messages.ts';
import { screenModel, type ViewNode } from './screen-model.ts';

const text = (id: string, en: string, tr = en) => ({ id, en, tr });

const components: ScreenComponent[] = [
  { id: 'bar', type: 'bar', var: 'hp' },
  { id: 'hidden', type: 'text', text: text('h', 'Low!'), if: 'hp < 5' },
  { id: 'inv', type: 'list', source: 'inventory' },
  { id: 'clue_list', type: 'list', source: 'variable', var: 'clues' },
  { id: 'ends', type: 'list', source: 'endings' },
  { id: 'cont', type: 'button', label: text('c', 'Continue'), actions: [{ type: 'continue' }] },
  {
    id: 'tabs',
    type: 'tabs',
    tabs: [
      {
        id: 't1',
        label: text('t1', 'Stats', 'Özellikler'),
        children: [{ id: 'st', type: 'list', source: 'stats' }],
      },
    ],
  },
];

function project(): StoryProject {
  return {
    format: 'imagination.story',
    schemaVersion: 1,
    id: 'p',
    title: { en: 'P', tr: 'P' },
    languages: ['en', 'tr'],
    start: 's',
    variables: [
      { id: 'hp', name: { en: 'HP', tr: 'Can' }, type: 'number', default: 15, max: 20, stat: true },
      { id: 'clues', name: { en: 'Clues', tr: 'İpuçları' }, type: 'list', default: ['mud'] },
    ],
    characters: [],
    screens: [{ id: 'panel', name: { en: 'Panel' }, kind: 'panel', children: components }],
    items: [{ id: 'key', name: { en: 'Key', tr: 'Anahtar' } }],
    chapters: [
      {
        id: 'c',
        title: { en: 'C', tr: 'C' },
        passages: [
          {
            id: 's',
            blocks: [
              { id: 'give', type: 'item', op: 'give', item: 'key' },
              { id: 'l1', type: 'narration', text: text('l1', 'Hi.') },
              { id: 'e1', type: 'end', ending: { id: 'good', title: text('good_t', 'Good end') } },
            ],
          },
        ],
      },
    ],
  };
}

function find(nodes: readonly ViewNode[], id: string): ViewNode | undefined {
  return nodes.find((n) => n.id === id);
}

describe('screen view model', () => {
  const story = compileStory(project());
  const runtime = new StoryRuntime(story);
  runtime.advance();
  const t = createTranslator(presentMessages, 'tr');

  it('reads bound values and hides components whose formula is false', () => {
    const nodes = screenModel(components, { runtime, locale: 'tr', t, canContinue: false });
    expect(find(nodes, 'bar')).toMatchObject({
      kind: 'bar',
      label: 'Can',
      value: 15,
      max: 20,
      fill: 0.75,
    });
    expect(find(nodes, 'hidden')).toBeUndefined();
    expect(find(nodes, 'cont')).toBeUndefined();
    expect(find(nodes, 'inv')).toMatchObject({ rows: [{ label: 'Anahtar', value: '1' }] });
    expect(find(nodes, 'clue_list')).toMatchObject({ rows: [{ label: 'mud' }] });
  });

  it('lists endings, locked until reached on this device', () => {
    const before = find(screenModel(components, { runtime, locale: 'en', t }), 'ends');
    expect(before).toMatchObject({ rows: [{ status: 'locked' }] });
    runtime.advance(); // past the line, onto the ending
    const after = find(screenModel(components, { runtime, locale: 'en', t }), 'ends');
    expect(after).toMatchObject({ rows: [{ label: 'Good end', status: 'done' }] });
  });

  it('renders tab labels in the reading language', () => {
    const tabs = find(screenModel(components, { runtime, locale: 'tr', t }), 'tabs');
    expect(tabs).toMatchObject({ tabs: [{ label: 'Özellikler', children: [{ kind: 'list' }] }] });
  });
});
