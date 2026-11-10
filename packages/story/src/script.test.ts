import { describe, expect, it } from 'vitest';
import { compileStory } from './compile.ts';
import type { Block, Passage, StoryProject } from './schema.ts';
import { alignLines, applyScript } from './script-apply.ts';
import { parseScript, passageToScript } from './script.ts';

function project(passages: Passage[]): StoryProject {
  return {
    format: 'imagination.story',
    schemaVersion: 1,
    id: 'test',
    title: { en: 'Test', tr: 'Test' },
    languages: ['en', 'tr'],
    start: passages[0]?.id ?? 'start',
    variables: [],
    characters: [{ id: 'mira', name: { en: 'Mira', tr: 'Mira' } }],
    chapters: [{ id: 'c1', title: { en: 'One', tr: 'Bir' }, passages }],
  };
}

const alley: Block[] = [
  { id: 'b1', type: 'narration', text: { id: 'l1', en: 'The rain fell.', tr: 'Yağmur yağdı.' } },
  {
    id: 'b2',
    type: 'dialogue',
    speaker: 'mira',
    text: { id: 'l2', en: 'You hear that?', tr: 'Duydun mu?' },
  },
  {
    id: 'b3',
    type: 'choice',
    options: [
      {
        id: 'o1',
        text: { id: 'l3', en: 'Run', tr: 'Kaç' },
        then: [{ id: 'j1', type: 'jump', to: 'p2' }],
      },
      { id: 'o2', text: { id: 'l4', en: 'Wait', tr: 'Bekle' }, then: [] },
    ],
  },
  {
    id: 'b4',
    type: 'if',
    branches: [{ id: 'br1', when: true, then: [] }],
  },
  { id: 'b5', type: 'end' },
];

const doc = () =>
  project([
    { id: 'p1', name: 'Alley', blocks: alley },
    { id: 'p2', name: 'Street', blocks: [{ id: 'b9', type: 'end' }] },
  ]);
const names = (p: StoryProject) => ({
  characters: p.characters,
  passages: p.chapters[0]!.passages,
});
const blocksOf = (p: StoryProject, id: string) =>
  p.chapters.flatMap((c) => c.passages).find((x) => x.id === id)!.blocks;

describe('script view', () => {
  it('writes a passage as script lines in either language', () => {
    const p = doc();
    expect(passageToScript(alley, 'en', names(p)).split('\n')).toEqual([
      'The rain fell.',
      'Mira: You hear that?',
      '* Run -> Street',
      '* Wait',
      '@if #b4',
      '@end',
    ]);
    expect(passageToScript(alley, 'tr', names(p))).toContain('Mira: Duydun mu?');
  });

  it('escapes narration that would read back as something else', () => {
    const blocks: Block[] = [
      { id: 'n1', type: 'narration', text: { id: 'x', en: '* not a choice' } },
      { id: 'n2', type: 'narration', text: { id: 'y', en: 'Mira: not dialogue' } },
    ];
    const script = passageToScript(blocks, 'en', names(doc()));
    expect(script).toBe('\\* not a choice\n\\Mira: not dialogue');
    const items = parseScript(script, names(doc()))[0]!.items;
    expect(items).toEqual([
      { k: 'text', text: '* not a choice' },
      { k: 'text', text: 'Mira: not dialogue' },
    ]);
  });

  it('reads sections, options, jumps, notes and commands', () => {
    const sections = parseScript(
      'Hello.\n\nMIRA: hi\n* A -> X\n* B\n-> Y\n// later\n@pause 1,5\n@end\n=== Next ===\nmore',
      names(doc()),
    );
    expect(sections).toHaveLength(2);
    expect(sections[0]!.items).toEqual([
      { k: 'text', text: 'Hello.' },
      { k: 'text', speaker: 'mira', text: 'hi' },
      { k: 'choice', options: [{ text: 'A', to: 'X' }, { text: 'B' }] },
      { k: 'jump', to: 'Y' },
      { k: 'note', text: 'later' },
      { k: 'pause', seconds: 1.5 },
      { k: 'end' },
    ]);
    expect(sections[1]).toEqual({ name: 'Next', items: [{ k: 'text', text: 'more' }] });
  });

  it('round-trips a passage without changing a thing', () => {
    const p = doc();
    const script = passageToScript(alley, 'en', names(p));
    const result = applyScript(p, 'p1', 'en', script);
    expect(blocksOf(result.project, 'p1')).toEqual(alley);
    // Unchanged blocks are the same objects, so undo snapshots share them.
    expect(blocksOf(result.project, 'p1')[0]).toBe(alley[0]);
    expect(result.created).toEqual([]);
  });

  it('keeps the other language when a line is edited or another is inserted', () => {
    const p = doc();
    const script = passageToScript(alley, 'en', names(p)).replace(
      'The rain fell.',
      'A new first line.\nThe rain fell hard.',
    );
    const blocks = blocksOf(applyScript(p, 'p1', 'en', script).project, 'p1');
    expect(blocks).toHaveLength(alley.length + 1);
    // The edited line keeps its id and Turkish text; the inserted one is new.
    const edited = blocks.find((b) => b.id === 'b1');
    expect(edited).toMatchObject({ text: { en: 'The rain fell hard.', tr: 'Yağmur yağdı.' } });
    expect(blocks[0]).toMatchObject({ type: 'narration', text: { en: 'A new first line.' } });
    expect(blocks[0]!.id).not.toBe('b1');
    expect(blocks.find((b) => b.id === 'b2')).toBe(alley[1]);
  });

  it('pastes new passages and makes the ones jumps name', () => {
    const p = doc();
    const result = applyScript(
      p,
      'p1',
      'tr',
      'Kapı açıldı.\n-> Bodrum\n=== Bodrum\nKaranlık.\n* Geri dön -> Alley',
    );
    expect(result.created).toEqual(['Bodrum']);
    const passages = result.project.chapters[0]!.passages;
    expect(passages.map((x) => x.name)).toEqual(['Alley', 'Street', 'Bodrum']);
    const cellar = passages[2]!;
    expect(blocksOf(result.project, 'p1')[1]).toMatchObject({ type: 'jump', to: cellar.id });
    expect(cellar.blocks[1]).toMatchObject({
      type: 'choice',
      options: [{ text: { tr: 'Geri dön' }, then: [{ type: 'jump', to: 'p1' }] }],
    });
    // The result is a valid story.
    expect(() => compileStory(result.project)).not.toThrow();
  });

  it('leaves out kept lines that match nothing or repeat', () => {
    const result = applyScript(doc(), 'p1', 'en', '@if #b4\n@if #b4\n@fight #nope');
    expect(blocksOf(result.project, 'p1')).toEqual([alley[3]]);
    expect(result.missing).toEqual(['b4', 'nope']);
  });

  it('aligns equal lines first, then edited ones by position', () => {
    expect(alignLines(['a', 'b', 'c'], ['a', 'x', 'b', 'c'])).toEqual([0, null, 1, 2]);
    expect(alignLines(['a', 'b', 'c'], ['a', 'B', 'c'])).toEqual([0, 1, 2]);
    expect(alignLines(['a', 'b'], ['b'])).toEqual([1]);
    expect(alignLines([], ['a'])).toEqual([null]);
    // An insertion and an edit in the same gap: the edit keeps its line.
    expect(alignLines(['x', 'the rain fell.'], ['x', 'new', 'the rain fell hard.'])).toEqual([
      0,
      null,
      1,
    ]);
  });
});
