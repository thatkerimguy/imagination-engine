// How a gimmick (module block) reads on paper: a bracketed summary, a readable scene cue, or
// nothing. Shared by every exporter. Pure (only the writer-safe module registry).
import type { ModuleBlock } from '@kn/core';
import { getWriterModule } from '../modules/registry.ts';
import type { GimmickMode } from './book-model.ts';

/** One printed line. `text` is plain (not markup). */
export interface CueLine {
  text: string;
  speaker?: string;
  italic?: boolean;
}

type Props = Record<string, unknown>;

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';
const isRecord = (v: unknown): v is Props =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function summary(block: ModuleBlock): { name: string; detail: string } {
  const mod = getWriterModule(block.moduleId);
  if (!mod) return { name: block.moduleId, detail: 'Unknown gimmick' };
  try {
    const card = mod.summarize(block.props);
    return { name: mod.meta.name, detail: card.subtitle || card.title };
  } catch {
    return { name: mod.meta.name, detail: 'Gimmick' };
  }
}

/** Dialogue-like lines found in props (`messages` / `lines` arrays of strings or objects). */
function messageLines(props: Props, fallbackSpeaker: string): CueLine[] {
  const out: CueLine[] = [];
  const base = [props.senderId, props.speaker, props.sender].find(isStr) ?? fallbackSpeaker;
  for (const key of ['messages', 'lines']) {
    const list = props[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (isStr(item)) out.push({ speaker: base, text: item.trim() });
      else if (isRecord(item) && isStr(item.text))
        out.push({ speaker: [item.speaker, item.sender].find(isStr) ?? base, text: item.text });
    }
  }
  return out;
}

/** An outcome sentence from `outcome` / `result` / `scriptedNumbers` style props. */
function outcomeLine(props: Props, name: string): CueLine | null {
  const scripted = props.outcomeMode === undefined || props.outcomeMode === 'scripted';
  for (const key of ['outcome', 'result', 'results', 'scriptedNumbers']) {
    const v = props[key];
    if (key === 'scriptedNumbers' && !scripted) continue;
    const list = Array.isArray(v)
      ? v.filter((x) => typeof x === 'string' || typeof x === 'number')
      : [v];
    const text = list.filter((x) => isStr(x) || typeof x === 'number').join(', ');
    if (text) return { text: `${name}: the result is ${text}.`, italic: true };
  }
  return null;
}

/**
 * Passages with a hidden second reading (a gaslit rewrite, a ghost line under a surface line):
 * on paper the visible text prints as prose, then the hidden one as an italic cue.
 */
const HIDDEN_PAIRS: readonly [shown: string, hidden: string, cue: string][] = [
  ['initialText', 'mutatedText', 'On a second look it reads'],
  ['surfaceLine', 'ghostLine', 'Beneath it, a ghost line'],
];

function pairLines(props: Props): CueLine[] {
  for (const [shown, hidden, cue] of HIDDEN_PAIRS) {
    const a = props[shown];
    const b = props[hidden];
    if (isStr(a) && isStr(b))
      return [{ text: a.trim() }, { text: `${cue}: “${b.trim()}”`, italic: true }];
  }
  return [];
}

/** Ignite / extinguish style beats (a lighter, a lamp) read as a short stage direction. */
const ACTION_CUES: Readonly<Record<string, string>> = {
  ignite: 'flicks alight',
  extinguish: 'snaps shut',
};

function actionLine(props: Props, name: string): CueLine | null {
  const verb = typeof props.action === 'string' ? ACTION_CUES[props.action] : undefined;
  return verb ? { text: `${name} ${verb}.`, italic: true } : null;
}

/** LitRPG system box: a header line, then each status line (its `lines` are not dialogue). */
function systemBoxLines(props: Props): CueLine[] | null {
  if (!Array.isArray(props.lines) || !isStr(props.title)) return null;
  const head = [props.header, props.title].filter(isStr).join(' ');
  return [{ text: head }, ...props.lines.filter(isStr).map((text) => ({ text: text.trim() }))];
}

/** The lines a module block contributes under `mode`. */
export function gimmickLines(block: ModuleBlock, mode: GimmickMode): CueLine[] {
  if (mode === 'omit') return [];
  const { name, detail } = summary(block);
  if (mode === 'summary') return [{ text: `[${name}: ${detail}]` }];
  const system = block.moduleId === 'litrpg-system-box' ? systemBoxLines(block.props) : null;
  if (system) return system;
  const messages = messageLines(block.props, name);
  if (messages.length) return messages;
  const pair = pairLines(block.props);
  if (pair.length) return pair;
  const action = actionLine(block.props, name);
  if (action) return [action];
  return [outcomeLine(block.props, name) ?? { text: `${name}: ${detail}`, italic: true }];
}
