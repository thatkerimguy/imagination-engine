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

/** The lines a module block contributes under `mode`. */
export function gimmickLines(block: ModuleBlock, mode: GimmickMode): CueLine[] {
  if (mode === 'omit') return [];
  const { name, detail } = summary(block);
  if (mode === 'summary') return [{ text: `[${name}: ${detail}]` }];
  const messages = messageLines(block.props, name);
  if (messages.length) return messages;
  return [outcomeLine(block.props, name) ?? { text: `${name}: ${detail}`, italic: true }];
}
