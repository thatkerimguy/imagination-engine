import { createId } from '@ie/core';
import { foldForSearch } from '@ie/i18n';
import type { StoryProject } from './project.ts';
import type {
  Block,
  ChoiceBlock,
  ChoiceOption,
  DialogueBlock,
  NarrationBlock,
  Passage,
} from './schema.ts';
import {
  isSimpleChoice,
  parseScript,
  type ScriptItem,
  type ScriptLocale,
  type ScriptNames,
} from './script.ts';

/*
 * Writing a script back into the project. Lines keep their block ids (and so the other language's
 * text) wherever they can be matched: unchanged lines by their text, edited lines by position
 * between unchanged ones, choices, jumps and the rest in order of appearance.
 */

export interface ScriptApplyResult {
  readonly project: StoryProject;
  /** Passages the script wrote, in order. */
  readonly passages: readonly string[];
  /** Names of passages made because a section or a jump named one that didn't exist. */
  readonly created: readonly string[];
  /** Kept-block ids that matched nothing (or appeared twice), so were left out. */
  readonly missing: readonly string[];
}

type TextBlock = NarrationBlock | DialogueBlock;
type TextItem = Extract<ScriptItem, { k: 'text' }>;

const isText = (b: Block): b is TextBlock => b.type === 'narration' || b.type === 'dialogue';
const textKey = (speaker: string | undefined, text: string) => `${speaker ?? ''}\u0000${text}`;

/** Similarity of two lines, 0 to 1: shared letter pairs (Dice). */
export function similarity(a: string, b: string): number {
  const pairs = (s: string) => {
    const out = new Map<string, number>();
    const t = s.toLocaleLowerCase('tr-TR');
    for (let i = 0; i < t.length - 1; i++) {
      const p = t.slice(i, i + 2);
      out.set(p, (out.get(p) ?? 0) + 1);
    }
    return out;
  };
  const pa = pairs(a);
  const pb = pairs(b);
  let total = 0;
  let shared = 0;
  for (const v of pa.values()) total += v;
  for (const [p, v] of pb) {
    total += v;
    shared += Math.min(v, pa.get(p) ?? 0);
  }
  return total === 0 ? (a === b ? 1 : 0) : (2 * shared) / total;
}

/** An edited line still shares this much with what it was. */
const EDITED = 0.4;

/**
 * The lines between two unchanged ones: the same count is a set of edits, paired in order;
 * otherwise lines are added or removed too, so each new line takes the most similar old one.
 */
function pairGap(
  oldKeys: readonly string[],
  newKeys: readonly string[],
  o0: number,
  o1: number,
  n0: number,
  n1: number,
  out: (number | null)[],
): void {
  if (o1 - o0 === n1 - n0) {
    for (let k = 0; o0 + k < o1; k++) out[n0 + k] = o0 + k;
    return;
  }
  const scores: [number, number, number][] = [];
  for (let i = o0; i < o1; i++) {
    for (let j = n0; j < n1; j++) scores.push([similarity(oldKeys[i]!, newKeys[j]!), i, j]);
  }
  scores.sort((x, y) => y[0] - x[0]);
  const usedOld = new Set<number>();
  for (const [score, i, j] of scores) {
    if (score < EDITED) break;
    if (usedOld.has(i) || out[j] !== null) continue;
    usedOld.add(i);
    out[j] = i;
  }
}

/** Pairs new lines with old ones: equal lines by longest common subsequence, then by position. */
export function alignLines(
  oldKeys: readonly string[],
  newKeys: readonly string[],
): (number | null)[] {
  const n = oldKeys.length;
  const m = newKeys.length;
  const table = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i]![j] =
        oldKeys[i] === newKeys[j]
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const out: (number | null)[] = new Array<number | null>(m).fill(null);
  const anchors: [number, number][] = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (oldKeys[i] === newKeys[j]) {
      anchors.push([i, j]);
      i++;
      j++;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) i++;
    else j++;
  }
  let oi = 0;
  let nj = 0;
  for (const [ai, aj] of [...anchors, [n, m] as [number, number]]) {
    pairGap(oldKeys, newKeys, oi, ai, nj, aj, out);
    if (ai < n) out[aj] = ai;
    oi = ai + 1;
    nj = aj + 1;
  }
  return out;
}

function namesOf(project: StoryProject): ScriptNames {
  return {
    characters: project.characters,
    passages: project.chapters.flatMap((c) => c.passages),
  };
}

export function applyScript(
  project: StoryProject,
  passageId: string,
  locale: ScriptLocale,
  source: string,
): ScriptApplyResult {
  const names = namesOf(project);
  const sections = parseScript(source, names);
  const all = project.chapters.flatMap((c) => c.passages);
  const created: string[] = [];
  const missing: string[] = [];
  const added: Passage[] = [];

  const findPassage = (name: string): Passage | undefined => {
    const folded = foldForSearch(name);
    return [...all, ...added].find(
      (p) => p.id === name || (p.name !== undefined && foldForSearch(p.name) === folded),
    );
  };
  const ensurePassage = (name: string): string => {
    const found = findPassage(name);
    if (found) return found.id;
    const passage: Passage = { id: createId('p'), name, blocks: [] };
    added.push(passage);
    created.push(name);
    return passage.id;
  };

  // Which passage each section writes; named sections are made first so jumps can find them.
  const targets = sections.map((s) => (s.name ? ensurePassage(s.name) : passageId));
  const keptById = new Map<string, Block>();
  // Only blocks of the passages this script writes: a kept line can move, never duplicate.
  for (const p of all) {
    if (targets.includes(p.id)) for (const b of p.blocks) keptById.set(b.id, b);
  }
  const keptUsed = new Set<string>();

  const rewritten = new Map<string, readonly Block[]>();
  sections.forEach((section, index) => {
    const target = targets[index]!;
    const old = [...all, ...added].find((p) => p.id === target)?.blocks ?? [];
    rewritten.set(target, rebuild(old, section.items));
  });

  function rebuild(old: readonly Block[], items: readonly ScriptItem[]): Block[] {
    const oldText = old.filter(isText);
    const newText = items.filter((i): i is TextItem => i.k === 'text');
    const pairs = alignLines(
      oldText.map((b) =>
        textKey(b.type === 'dialogue' ? b.speaker : undefined, b.text[locale] ?? ''),
      ),
      newText.map((i) => textKey(i.speaker, i.text)),
    );
    let textIndex = 0;
    const queues = new Map<string, Block[]>();
    for (const b of old) {
      if (isText(b) || (b.type === 'choice' && !isSimpleChoice(b))) continue;
      queues.set(b.type, [...(queues.get(b.type) ?? []), b]);
    }
    const take = <T extends Block['type']>(type: T) =>
      queues.get(type)?.shift() as Extract<Block, { type: T }> | undefined;

    const out: Block[] = [];
    for (const item of items) {
      switch (item.k) {
        case 'text': {
          const at = pairs[textIndex++];
          const prev = at === null || at === undefined ? undefined : oldText[at];
          out.push(textBlock(prev, item));
          break;
        }
        case 'choice':
          out.push(choiceBlock(take('choice'), item.options));
          break;
        case 'jump':
          out.push({
            id: take('jump')?.id ?? createId('b'),
            type: 'jump',
            to: ensurePassage(item.to),
          });
          break;
        case 'note':
          out.push({ id: take('note')?.id ?? createId('b'), type: 'note', text: item.text });
          break;
        case 'end': {
          const prev = take('end');
          out.push(prev && !prev.ending ? prev : { id: createId('b'), type: 'end' });
          break;
        }
        case 'pause': {
          const id = take('pause')?.id ?? createId('b');
          out.push(
            item.seconds ? { id, type: 'pause', seconds: item.seconds } : { id, type: 'pause' },
          );
          break;
        }
        case 'keep': {
          const block = keptById.get(item.id);
          if (!block || keptUsed.has(item.id)) missing.push(item.id);
          else {
            keptUsed.add(item.id);
            out.push(block);
          }
          break;
        }
      }
    }
    return out;
  }

  function textBlock(prev: TextBlock | undefined, item: TextItem): Block {
    const text = prev
      ? prev.text[locale] === item.text
        ? prev.text
        : { ...prev.text, [locale]: item.text }
      : { id: createId('l'), [locale]: item.text };
    const id = prev?.id ?? createId('b');
    if (item.speaker) {
      if (prev?.type === 'dialogue' && prev.speaker === item.speaker && prev.text === text)
        return prev;
      return { id, type: 'dialogue', speaker: item.speaker, text };
    }
    if (prev?.type === 'narration' && prev.text === text) return prev;
    return { id, type: 'narration', text };
  }

  function choiceBlock(
    prev: ChoiceBlock | undefined,
    options: readonly { text: string; to?: string }[],
  ): ChoiceBlock {
    return {
      id: prev?.id ?? createId('b'),
      type: 'choice',
      options: options.map((o, i): ChoiceOption => {
        const old = prev?.options[i];
        const text = old
          ? old.text[locale] === o.text
            ? old.text
            : { ...old.text, [locale]: o.text }
          : { id: createId('l'), [locale]: o.text };
        const oldJump = old?.then[0];
        const then: Block[] = o.to
          ? [{ id: oldJump?.id ?? createId('b'), type: 'jump', to: ensurePassage(o.to) }]
          : [];
        return { id: old?.id ?? createId('o'), text, then };
      }),
    };
  }

  // New passages go into the chapter of the open passage, after the last one written.
  const home = project.chapters.find((c) => c.passages.some((p) => p.id === passageId));
  const chapters = project.chapters.map((chapter) => {
    let passages = chapter.passages.map((p) => {
      const blocks = rewritten.get(p.id);
      return blocks ? { ...p, blocks } : p;
    });
    if (chapter === home && added.length > 0) {
      passages = [...passages, ...added.map((p) => ({ ...p, blocks: rewritten.get(p.id) ?? [] }))];
    }
    return passages === chapter.passages ? chapter : { ...chapter, passages };
  });

  return {
    project: { ...project, chapters },
    passages: [...new Set(targets)],
    created,
    missing,
  };
}
