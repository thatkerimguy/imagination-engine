/**
 * Text markup (ADR 0007): `{gold}`, `{@mira}`, `{name}'e`, ICU-style plural/select, and effect
 * tags such as `[shake]…[/shake]` and `[pause=400]`. `[[`, `]]` and `{{` write the literal
 * character. A case body can't contain a literal `}` (it would end the case).
 */
export type MarkupNode =
  | { readonly t: 'text'; readonly v: string }
  | { readonly t: 'var'; readonly id: string; readonly suffix?: string }
  | { readonly t: 'char'; readonly id: string; readonly suffix?: string }
  | {
      readonly t: 'plural' | 'select';
      readonly id: string;
      readonly cases: Readonly<Record<string, readonly MarkupNode[]>>;
    }
  | { readonly t: 'hash' }
  | {
      readonly t: 'fx';
      readonly name: EffectName;
      readonly arg?: string;
      readonly children: readonly MarkupNode[];
    }
  | { readonly t: 'pause'; readonly ms: number };

export const EFFECTS = [
  'b',
  'i',
  'shake',
  'tremble',
  'wave',
  'whisper',
  'shout',
  'fade',
  'scramble',
  'color',
  'speed',
] as const;
export type EffectName = (typeof EFFECTS)[number];

export class MarkupError extends Error {
  constructor(
    message: string,
    readonly position: number,
  ) {
    super(message);
    this.name = 'MarkupError';
  }
}

const isEffect = (name: string): name is EffectName =>
  (EFFECTS as readonly string[]).includes(name);
const SUFFIX = /^['’](\p{L}+)/u;

export function parseMarkup(source: string): MarkupNode[] {
  let i = 0;

  // `inCase`: inside a plural/select case, where # stands for the count.
  function parseNodes(closer: 'end' | 'case', openTags: string[], inCase: boolean): MarkupNode[] {
    const nodes: MarkupNode[] = [];
    let text = '';
    const flush = () => {
      if (text) nodes.push({ t: 'text', v: text });
      text = '';
    };

    while (i < source.length) {
      const c = source.charAt(i);
      const two = source.slice(i, i + 2);
      if (two === '[[' || two === ']]' || two === '{{') {
        text += c;
        i += 2;
        continue;
      }
      if (closer === 'case' && c === '}') return flushed();
      if (inCase && c === '#') {
        flush();
        nodes.push({ t: 'hash' });
        i++;
        continue;
      }
      if (c === '[') {
        const close = /^\[\/([a-z]+)\]/.exec(source.slice(i));
        if (close) {
          const name = close[1] ?? '';
          if (openTags.at(-1) !== name)
            throw new MarkupError(`"[/${name}]" closes a tag that isn't open.`, i);
          i += close[0].length;
          return flushed();
        }
        const open = /^\[([a-z]+)(?:=([^\]]*))?\]/.exec(source.slice(i));
        if (!open)
          throw new MarkupError('A "[" starts a tag that never ends. Write [[ for a plain [.', i);
        const name = open[1] ?? '';
        const arg = open[2];
        const start = i;
        i += open[0].length;
        flush();
        if (name === 'pause') {
          const ms = Number(arg);
          if (!Number.isFinite(ms) || ms < 0)
            throw new MarkupError('[pause] needs a time in milliseconds, like [pause=400].', start);
          nodes.push({ t: 'pause', ms });
          continue;
        }
        if (!isEffect(name)) throw new MarkupError(`There is no "${name}" effect.`, start);
        const children = parseNodes('end', [...openTags, name], inCase);
        if (source.slice(i - name.length - 3, i) !== `[/${name}]`) {
          throw new MarkupError(`"[${name}]" is never closed with [/${name}].`, start);
        }
        nodes.push(
          arg === undefined ? { t: 'fx', name, children } : { t: 'fx', name, arg, children },
        );
        continue;
      }
      if (c === '{') {
        flush();
        nodes.push(parsePlaceholder());
        continue;
      }
      text += c;
      i++;
    }
    if (closer === 'case') throw new MarkupError('A "{" choice is missing its closing "}".', i);
    return flushed();

    function flushed(): MarkupNode[] {
      flush();
      return nodes;
    }
  }

  function parsePlaceholder(): MarkupNode {
    const start = i;
    const head = /^\{(@?)([A-Za-z][A-Za-z0-9_]*)\s*/.exec(source.slice(i));
    if (!head)
      throw new MarkupError('A "{" must name a variable, like {gold}. Write {{ for a plain {.', i);
    i += head[0].length;
    const isCharacter = head[1] === '@';
    const id = head[2] ?? '';
    if (source.charAt(i) === '}') {
      i++;
      const suffix = SUFFIX.exec(source.slice(i));
      if (suffix) i += suffix[0].length;
      const node = { t: isCharacter ? ('char' as const) : ('var' as const), id };
      return suffix?.[1] ? { ...node, suffix: suffix[1] } : node;
    }
    const kind = /^,\s*(plural|select)\s*,\s*/.exec(source.slice(i));
    if (!kind || isCharacter)
      throw new MarkupError(`"{${head[1] ?? ''}${id}" is missing its closing "}".`, start);
    i += kind[0].length;
    const cases: Record<string, MarkupNode[]> = {};
    for (;;) {
      const key = /^\s*(=\d+|[A-Za-z0-9_]+)\s*\{/.exec(source.slice(i));
      if (!key) break;
      i += key[0].length;
      cases[key[1] ?? 'other'] = parseNodes('case', [], true);
      i++; // the case's closing }
    }
    const end = /^\s*\}/.exec(source.slice(i));
    if (!end)
      throw new MarkupError(`The ${kind[1] ?? ''} for "${id}" is missing its closing "}".`, start);
    i += end[0].length;
    if (!('other' in cases))
      throw new MarkupError(`The ${kind[1] ?? ''} for "${id}" needs an "other" case.`, start);
    return { t: kind[1] === 'plural' ? 'plural' : 'select', id, cases };
  }

  return parseNodes('end', [], false);
}

/** Variables and characters a parsed text refers to. */
export function markupReferences(nodes: readonly MarkupNode[]): {
  vars: Set<string>;
  characters: Set<string>;
} {
  const found = { vars: new Set<string>(), characters: new Set<string>() };
  const walk = (list: readonly MarkupNode[]) => {
    for (const node of list) {
      if (node.t === 'var') found.vars.add(node.id);
      else if (node.t === 'char') found.characters.add(node.id);
      else if (node.t === 'plural' || node.t === 'select') {
        found.vars.add(node.id);
        Object.values(node.cases).forEach(walk);
      } else if (node.t === 'fx') walk(node.children);
    }
  };
  walk(nodes);
  return found;
}
