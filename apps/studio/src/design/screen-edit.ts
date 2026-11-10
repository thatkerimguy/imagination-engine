import { createId } from '@ie/core';
import type {
  ComponentType,
  Label,
  ScreenComponent,
  ScreenDef,
  ScreenKind,
  StoryProject,
} from '@ie/story';
import { newText } from '../project/factory.ts';

/*
 * Pure edits on a project's screens. Every list of components has a key, like block lists do:
 * `s:<screen>` for a screen's own contents, `c:<component>` for a stack's or grid's, and
 * `t:<tab>` for a tab's.
 */

export const screenListKey = {
  screen: (id: string) => `s:${id}`,
  component: (id: string) => `c:${id}`,
  tab: (id: string) => `t:${id}`,
} as const;

type Components = readonly ScreenComponent[];
type ListMapper = (key: string, list: Components) => Components;

export function newScreen(kind: ScreenKind, name: Label): ScreenDef {
  return {
    id: createId('scr'),
    name,
    kind,
    ...(kind === 'hud' ? { edge: 'top' as const } : {}),
    children: [],
  };
}

/** Words a new component starts with, in both languages (a button's label, a tab's name). */
export interface ComponentDefaults {
  readonly label?: Label;
}

export function newComponent(
  type: ComponentType,
  defaults: ComponentDefaults = {},
): ScreenComponent {
  const id = createId('c');
  const label = newText(defaults.label?.en, defaults.label?.tr);
  switch (type) {
    case 'stack':
      return { id, type, direction: 'column', children: [] };
    case 'grid':
      return { id, type, columns: 2, children: [] };
    case 'text':
      return { id, type, text: label };
    case 'bar':
      return { id, type, var: '' };
    case 'icon':
      return { id, type, icon: 'star' };
    case 'list':
      return { id, type, source: 'inventory' };
    case 'button':
      return { id, type, label, actions: [] };
    case 'tabs':
      return { id, type, tabs: [{ id: createId('tab'), label, children: [] }] };
  }
}

function mapList(key: string, list: Components, map: ListMapper): Components {
  return map(
    key,
    list.map((c) => mapChildren(c, map)),
  );
}

function mapChildren(component: ScreenComponent, map: ListMapper): ScreenComponent {
  switch (component.type) {
    case 'stack':
    case 'grid':
      return {
        ...component,
        children: mapList(screenListKey.component(component.id), component.children, map),
      };
    case 'tabs':
      return {
        ...component,
        tabs: component.tabs.map((tab) => ({
          ...tab,
          children: mapList(screenListKey.tab(tab.id), tab.children, map),
        })),
      };
    default:
      return component;
  }
}

/** Runs `map` over every component list of every screen, innermost lists first. */
export function mapScreenLists(project: StoryProject, map: ListMapper): StoryProject {
  const screens = project.screens;
  if (!screens) return project;
  return {
    ...project,
    screens: screens.map((s) => ({
      ...s,
      children: mapList(screenListKey.screen(s.id), s.children, map),
    })),
  };
}

export function updateScreen(
  project: StoryProject,
  id: string,
  change: (screen: ScreenDef) => ScreenDef,
): StoryProject {
  return {
    ...project,
    screens: (project.screens ?? []).map((s) => (s.id === id ? change(s) : s)),
  };
}

export function insertComponent(
  project: StoryProject,
  key: string,
  index: number,
  component: ScreenComponent,
): StoryProject {
  return mapScreenLists(project, (k, list) =>
    k === key ? list.toSpliced(index, 0, component) : list,
  );
}

export function updateComponent(
  project: StoryProject,
  id: string,
  change: (component: ScreenComponent) => ScreenComponent,
): StoryProject {
  return mapScreenLists(project, (_k, list) => {
    const index = list.findIndex((c) => c.id === id);
    return index < 0 ? list : list.with(index, change(list[index] as ScreenComponent));
  });
}

export function removeComponent(project: StoryProject, id: string): StoryProject {
  return mapScreenLists(project, (_k, list) =>
    list.some((c) => c.id === id) ? list.filter((c) => c.id !== id) : list,
  );
}

export function moveComponent(project: StoryProject, id: string, delta: -1 | 1): StoryProject {
  return mapScreenLists(project, (_k, list) => {
    const from = list.findIndex((c) => c.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return list;
    return list.with(from, list[to] as ScreenComponent).with(to, list[from] as ScreenComponent);
  });
}
