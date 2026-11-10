import { describe, expect, it } from 'vitest';
import { analyzeProject } from './analyze.ts';
import {
  addToProject,
  itemsFromPack,
  libraryItem,
  libraryItemSchema,
  makePack,
  parsePack,
  withFreshIds,
  type LibraryItem,
} from './library.ts';
import type { MaterialDef } from './material.ts';
import { storyProjectSchema, type StoryProject } from './project.ts';
import type { ScreenDef } from './screens.ts';

const project: StoryProject = {
  format: 'imagination.story',
  schemaVersion: 1,
  id: 'lib',
  title: { en: 'Library' },
  languages: ['en'],
  start: 'p1',
  variables: [],
  characters: [],
  chapters: [
    {
      id: 'c1',
      title: { en: 'One' },
      passages: [
        { id: 'p1', blocks: [{ id: 'l1', type: 'narration', text: { id: 'l1', en: 'Rain.' } }] },
      ],
    },
  ],
};

const material: MaterialDef = {
  id: 'mat_glow',
  name: { en: 'Glow', tr: 'Parıltı' },
  domain: 'text',
  nodes: [
    { id: 'mn_a', type: 'param', x: 0, y: 0, param: 'mp_amount' },
    { id: 'mn_out', type: 'output', x: 200, y: 0, inputs: { color: { node: 'mn_a' } } },
  ],
  params: [{ id: 'mp_amount', name: { en: 'Amount' }, default: 0.5, min: 0, max: 1 }],
};

const screen: ScreenDef = {
  id: 'scr_hud',
  name: { en: 'HUD' },
  kind: 'hud',
  children: [{ id: 'c_text', type: 'text', text: { id: 't_text', en: 'Day', tr: 'Gün' } }],
};

const enemy = libraryItem(
  {
    kind: 'enemy',
    data: {
      id: 'en_thug',
      name: { en: 'Thug', tr: 'Serseri' },
      moves: [
        { id: 'm_cut', name: { en: 'Cut' }, pattern: 'jab', answer: 'parry', sequence: 'sq_cut' },
      ],
    },
  },
  '  Thug  ',
  1000,
);

describe('library items', () => {
  it('hold a validated copy under a new ID', () => {
    expect(enemy).toMatchObject({ kind: 'enemy', name: 'Thug', addedAt: 1000 });
    expect(enemy.id).toMatch(/^lib_/);
    expect(libraryItemSchema.safeParse(enemy).success).toBe(true);
    expect(libraryItemSchema.safeParse({ ...enemy, kind: 'material' }).success).toBe(false);
    expect(
      libraryItemSchema.safeParse({ ...enemy, kind: 'effect', data: { action: 'story.jump' } })
        .success,
    ).toBe(false);
  });

  it('get fresh IDs that keep their own links and leave outside references alone', () => {
    const copy = withFreshIds(material);
    const [param, output] = copy.nodes;
    expect(copy.id).not.toBe(material.id);
    expect(copy.id).toMatch(/^mat_/);
    expect(copy.name).toEqual(material.name);
    expect(param?.param).toBe(copy.params[0]?.id);
    expect(param?.param).not.toBe('mp_amount');
    expect(output?.inputs?.color?.node).toBe(param?.id);

    const thug = withFreshIds(enemy.kind === 'enemy' ? enemy.data : null);
    expect(thug?.moves[0]?.sequence).toBe('sq_cut');
    expect(thug?.moves[0]?.id).not.toBe('m_cut');
  });
});

describe('adding to a project', () => {
  const add = (item: LibraryItem, into = project, passage = 'p1') => {
    const next = addToProject(into, item, { passage });
    if (typeof next === 'string') throw new Error(next);
    return next;
  };

  it('copies each kind into its place and the project stays valid', () => {
    let next = add(enemy);
    next = add(libraryItem({ kind: 'material', data: material }, 'Glow'), next);
    next = add(libraryItem({ kind: 'screen', data: screen }, 'HUD'), next);
    next = add(libraryItem({ kind: 'theme', data: { preset: 'noir' } }, 'Noir'), next);
    next = add(
      libraryItem(
        { kind: 'effect', data: { action: 'stage.shake', params: { strength: 0.6 } } },
        'Hard shake',
      ),
      next,
    );
    expect(storyProjectSchema.safeParse(next).success).toBe(true);
    expect(next.enemies).toHaveLength(1);
    expect(next.materials?.[0]?.id).not.toBe(material.id);
    expect(next.theme).toEqual({ preset: 'noir' });
    expect(next.chapters[0]?.passages[0]?.blocks.at(-1)).toMatchObject({
      type: 'action',
      action: 'stage.shake',
      params: { strength: 0.6 },
    });
    expect(project.chapters[0]?.passages[0]?.blocks).toHaveLength(1);
  });

  it('can add the same screen twice without clashing IDs or lines', () => {
    const item = libraryItem({ kind: 'screen', data: screen }, 'HUD');
    const twice = add(item, add(item));
    expect(twice.screens).toHaveLength(2);
    const codes = analyzeProject(twice).problems.map((p) => p.code);
    expect(codes).not.toContain('duplicate-id');
    expect(codes).not.toContain('duplicate-line');
  });

  it('says why when there is no passage or no room', () => {
    const effect = libraryItem({ kind: 'effect', data: { action: 'stage.flash' } }, 'Flash');
    expect(addToProject(project, effect, { passage: 'gone' })).toBe('no-passage');
    const full = { ...project, screens: Array.from({ length: 40 }, () => withFreshIds(screen)) };
    expect(addToProject(full, libraryItem({ kind: 'screen', data: screen }, 'HUD'))).toBe('full');
  });
});

describe('packs', () => {
  it('round-trip through a file and arrive under new IDs', () => {
    const pack = makePack('  Starter  ', [enemy]);
    expect(pack.name).toBe('Starter');
    const read = parsePack(JSON.stringify(pack));
    expect(read).toEqual(pack);
    const [imported] = itemsFromPack(read, 2000);
    expect(imported).toMatchObject({ kind: 'enemy', name: 'Thug', addedAt: 2000 });
    expect(imported?.id).not.toBe(enemy.id);
  });

  it('refuse files that are not packs', () => {
    expect(() => parsePack('{nope')).toThrow('not-json');
    expect(() => parsePack(JSON.stringify(project))).toThrow();
    const bad = { ...makePack('Bad', [enemy]), items: [{ ...enemy, data: { id: 'x' } }] };
    expect(() => parsePack(JSON.stringify(bad))).toThrow();
  });
});
