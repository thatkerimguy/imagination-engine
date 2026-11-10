import {
  COMPONENT_TYPES,
  storyProjectSchema,
  walkComponents,
  type ScreenComponent,
  type StoryProject,
} from '@ie/story';
import { describe, expect, it } from 'vitest';
import { newProject } from '../project/factory.ts';
import {
  insertComponent,
  moveComponent,
  newComponent,
  newScreen,
  removeComponent,
  screenListKey,
  updateComponent,
} from './screen-edit.ts';

function setup() {
  const screen = newScreen('hud', { en: 'HUD', tr: 'Gösterge' });
  const doc: StoryProject = { ...newProject({ en: 'X', tr: 'X' }), screens: [screen] };
  return { doc, screen };
}

function ids(list: readonly ScreenComponent[]): string[] {
  const out: string[] = [];
  walkComponents(list, (c) => out.push(c.id));
  return out;
}

describe('screen edits', () => {
  it('new components keep the project a valid document', () => {
    const { doc, screen } = setup();
    let next = doc;
    for (const type of COMPONENT_TYPES)
      next = insertComponent(next, screenListKey.screen(screen.id), 0, newComponent(type));
    expect(storyProjectSchema.safeParse(next).success).toBe(true);
    expect(next.screens?.[0]?.children).toHaveLength(COMPONENT_TYPES.length);
  });

  it('inserts into nested stacks and tabs', () => {
    const { doc, screen } = setup();
    const stack = newComponent('stack');
    const tabs = newComponent('tabs');
    if (tabs.type !== 'tabs') throw new Error('fixture');
    const tab = tabs.tabs[0];
    if (!tab) throw new Error('fixture');
    let next = insertComponent(doc, screenListKey.screen(screen.id), 0, stack);
    next = insertComponent(next, screenListKey.component(stack.id), 0, tabs);
    const text = newComponent('text');
    next = insertComponent(next, screenListKey.tab(tab.id), 0, text);
    expect(ids(next.screens?.[0]?.children ?? [])).toEqual([stack.id, tabs.id, text.id]);
  });

  it('updates, moves and removes anywhere in the tree', () => {
    const { doc, screen } = setup();
    const stack = newComponent('stack');
    const a = newComponent('icon');
    const b = newComponent('bar');
    let next = insertComponent(doc, screenListKey.screen(screen.id), 0, stack);
    next = insertComponent(next, screenListKey.component(stack.id), 0, a);
    next = insertComponent(next, screenListKey.component(stack.id), 1, b);
    next = moveComponent(next, b.id, -1);
    expect(ids(next.screens?.[0]?.children ?? [])).toEqual([stack.id, b.id, a.id]);
    expect(moveComponent(next, b.id, -1)).toEqual(next);
    next = updateComponent(next, a.id, (c) => (c.type === 'icon' ? { ...c, icon: 'heart' } : c));
    const found: ScreenComponent[] = [];
    walkComponents(next.screens?.[0]?.children ?? [], (c) => c.id === a.id && found.push(c));
    expect(found[0]).toMatchObject({ icon: 'heart' });
    next = removeComponent(next, stack.id);
    expect(next.screens?.[0]?.children).toEqual([]);
  });
});
