import { foldForSearch, upper } from '@ie/i18n';
import type { Block, ChoiceBlock, Label, Passage } from './schema.ts';

/*
 * Script view (PLAN §3.3): a plain-text form of a passage for fast typing and for pasting from any
 * writing app. One line is one block:
 *
 *   === Name            starts another passage (found by name, or made)
 *   Mira: You hear that?  a dialogue line, when Mira is a character
 *   * Run -> Alley      a choice option; lines of options in a row are one choice
 *   -> Alley            a jump
 *   // a note           a note for the author
 *   @end  @pause 2      an End block, a Pause block (seconds optional)
 *   @fight #b_x …       a block the script can't show, kept as it is (found by its id)
 *   \* not an option    a backslash makes any line plain narration
 *   anything else       narration
 *
 * Blank lines are ignored. Everything here is pure; scriptApply.ts writes the result into a project.
 */

export type ScriptLocale = 'en' | 'tr';

export interface ScriptNames {
  readonly characters: readonly { readonly id: string; readonly name: Label }[];
  readonly passages: readonly Pick<Passage, 'id' | 'name'>[];
}

export type ScriptItem =
  | { readonly k: 'text'; readonly speaker?: string; readonly text: string }
  | { readonly k: 'choice'; readonly options: readonly ScriptOption[] }
  | { readonly k: 'jump'; readonly to: string }
  | { readonly k: 'note'; readonly text: string }
  | { readonly k: 'end' }
  | { readonly k: 'pause'; readonly seconds?: number }
  | { readonly k: 'keep'; readonly id: string };

export interface ScriptOption {
  readonly text: string;
  /** A passage name (or id) to jump to. */
  readonly to?: string;
}

export interface ScriptSection {
  /** Absent for the lines before the first `===`: they belong to the open passage. */
  readonly name?: string;
  readonly items: readonly ScriptItem[];
}

const ARROW = '->';

const labelIn = (label: Label, locale: ScriptLocale) =>
  label[locale] || label[locale === 'en' ? 'tr' : 'en'] || '';

const passageName = (names: ScriptNames, id: string) => {
  const p = names.passages.find((x) => x.id === id);
  return p ? p.name || p.id : id;
};

/** A simple choice is one the script can write out in full: options with text and maybe a jump. */
export function isSimpleChoice(block: ChoiceBlock): boolean {
  if (block.prompt || block.timer) return false;
  return block.options.every(
    (o) =>
      o.visibleIf === undefined &&
      o.enabledIf === undefined &&
      !o.lockedText &&
      !o.cost &&
      !o.once &&
      !o.showOdds &&
      (o.then.length === 0 || (o.then.length === 1 && o.then[0]?.type === 'jump')),
  );
}

/** Would this narration line read back as something else? Then it needs a backslash. */
function needsEscape(text: string, names: ScriptNames): boolean {
  const t = text.trimStart();
  if (/^(===|\*|->|\/\/|@|\\)/.test(t)) return true;
  return speakerOf(t, names) !== null;
}

function speakerOf(line: string, names: ScriptNames): { id: string; rest: string } | null {
  const colon = line.indexOf(':');
  if (colon <= 0 || colon > 40) return null;
  const who = foldForSearch(line.slice(0, colon).trim());
  if (!who) return null;
  const match = names.characters.find(
    (c) =>
      foldForSearch(c.name.en ?? '') === who ||
      foldForSearch(c.name.tr ?? '') === who ||
      foldForSearch(c.id) === who,
  );
  return match ? { id: match.id, rest: line.slice(colon + 1).trim() } : null;
}

/** A kept block's line: its kind, its id, and a short reminder of what it is (ignored on read). */
function keepLine(block: Block, hint = ''): string {
  return `@${block.type} #${block.id}${hint ? `  ${hint}` : ''}`;
}

/** The passage's blocks as script lines in one language. */
export function passageToScript(
  blocks: readonly Block[],
  locale: ScriptLocale,
  names: ScriptNames,
): string {
  const other: ScriptLocale = locale === 'en' ? 'tr' : 'en';
  const lines: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case 'narration': {
        const text = block.text[locale] ?? '';
        if (!text && block.text[other]) {
          // Not written in this language yet: keep its place and show the other language.
          lines.push(keepLine(block, `${upper(other, 'en')}: ${block.text[other]}`));
        } else lines.push(needsEscape(text, names) ? `\\${text}` : text);
        break;
      }
      case 'dialogue': {
        const who = names.characters.find((c) => c.id === block.speaker);
        const text = block.text[locale] ?? '';
        if (!who || (!text && block.text[other])) lines.push(keepLine(block, block.text[other]));
        else lines.push(`${labelIn(who.name, locale) || who.id}: ${text}`);
        break;
      }
      case 'choice':
        if (!isSimpleChoice(block)) {
          lines.push(keepLine(block, block.options.map((o) => o.text[locale] ?? '').join(' / ')));
          break;
        }
        for (const o of block.options) {
          const jump = o.then[0];
          const to =
            jump?.type === 'jump' && jump.to ? ` ${ARROW} ${passageName(names, jump.to)}` : '';
          lines.push(`* ${o.text[locale] ?? ''}${to}`);
        }
        break;
      case 'jump':
        lines.push(block.to ? `${ARROW} ${passageName(names, block.to)}` : keepLine(block));
        break;
      case 'note':
        lines.push(`// ${block.text}`);
        break;
      case 'end':
        lines.push(block.ending ? keepLine(block, block.ending.title[locale] ?? '') : '@end');
        break;
      case 'pause':
        lines.push(block.seconds ? `@pause ${block.seconds}` : '@pause');
        break;
      default:
        lines.push(keepLine(block));
    }
  }
  return lines.join('\n');
}

function splitArrow(text: string): { text: string; to?: string } {
  const at = text.lastIndexOf(ARROW);
  if (at < 0) return { text: text.trim() };
  const to = text.slice(at + ARROW.length).trim();
  return to ? { text: text.slice(0, at).trim(), to } : { text: text.trim() };
}

/** Reads script text into sections of items. Never throws: unknown lines are narration. */
export function parseScript(source: string, names: ScriptNames): ScriptSection[] {
  const sections: { name?: string; items: ScriptItem[] }[] = [{ items: [] }];
  let items = sections[0]!.items;
  let options: ScriptOption[] | null = null;
  const push = (item: ScriptItem) => {
    options = null;
    items.push(item);
  };

  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('\\')) {
      push({ k: 'text', text: line.slice(1) });
      continue;
    }
    if (line.startsWith('===')) {
      const name = line.replace(/^=+/, '').replace(/=+$/, '').trim();
      options = null;
      items = [];
      sections.push({ ...(name ? { name } : {}), items });
      continue;
    }
    if (line.startsWith('*')) {
      const option = splitArrow(line.slice(1));
      if (options) options.push(option);
      else {
        const list: ScriptOption[] = [option];
        items.push({ k: 'choice', options: list });
        options = list;
      }
      continue;
    }
    if (line.startsWith(ARROW)) {
      const to = line.slice(ARROW.length).trim();
      push(to ? { k: 'jump', to } : { k: 'text', text: line });
      continue;
    }
    if (line.startsWith('//')) {
      push({ k: 'note', text: line.slice(2).trim() });
      continue;
    }
    if (line.startsWith('@')) {
      const kept = /#([A-Za-z][A-Za-z0-9_]*)/.exec(line);
      const word = /^@(\w+)/.exec(line)?.[1]?.toLowerCase();
      if (kept?.[1]) push({ k: 'keep', id: kept[1] });
      else if (word === 'end') push({ k: 'end' });
      else if (word === 'pause') {
        const seconds = Number(line.slice('@pause'.length).trim().replace(',', '.'));
        push(seconds > 0 ? { k: 'pause', seconds } : { k: 'pause' });
      } else push({ k: 'text', text: line });
      continue;
    }
    const speaker = speakerOf(line, names);
    push(
      speaker ? { k: 'text', speaker: speaker.id, text: speaker.rest } : { k: 'text', text: line },
    );
  }
  // An empty first section (the script starts with `===`) is dropped.
  return sections.filter((s, i) => i > 0 || s.items.length > 0 || sections.length === 1);
}
