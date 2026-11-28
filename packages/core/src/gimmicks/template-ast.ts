// Tiny template parser for blueprint export templates. Zero dependencies, never `eval`.
// Grammar (blocks nest freely; unknown or unbalanced tags degrade to nothing, never throw):
//   {{key}} {{.}} {{@n}}                      values
//   {{#each key}} ... {{/each}}               loop over a list (or one scalar)
//   {{#if key}} ... {{else}} ... {{/if}}      optional section ({{#if .}} tests the loop item)

export type TemplateNode =
  | { kind: 'text'; text: string }
  | { kind: 'value'; key: string }
  | { kind: 'each'; key: string; body: TemplateNode[] }
  | { kind: 'if'; key: string; then: TemplateNode[]; else: TemplateNode[] };

const TAG = /\{\{\s*(#each|#if|\/each|\/if|else)?\s*(\.|@n|[a-zA-Z][a-zA-Z0-9]*)?\s*\}\}/g;

interface Frame {
  open: 'root' | 'each' | 'if';
  node: TemplateNode | null;
  /** Children currently being appended to (an `if` switches to `else` on `{{else}}`). */
  out: TemplateNode[];
}

/** Parses a template into a node tree. */
export function parseTemplate(tpl: string): TemplateNode[] {
  const root: TemplateNode[] = [];
  const stack: Frame[] = [{ open: 'root', node: null, out: root }];
  const top = (): Frame => stack[stack.length - 1]!;
  let last = 0;
  for (const m of tpl.matchAll(TAG)) {
    if (m.index > last) top().out.push({ kind: 'text', text: tpl.slice(last, m.index) });
    last = m.index + m[0].length;
    const [, op, key] = m;
    if (!op) {
      if (key) top().out.push({ kind: 'value', key });
    } else if (op === '#each' || op === '#if') {
      if (!key) continue;
      const node: TemplateNode =
        op === '#each' ? { kind: 'each', key, body: [] } : { kind: 'if', key, then: [], else: [] };
      top().out.push(node);
      const out = node.kind === 'each' ? node.body : node.kind === 'if' ? node.then : [];
      stack.push({ open: op === '#each' ? 'each' : 'if', node, out });
    } else if (op === 'else') {
      const f = top();
      if (f.open === 'if' && f.node?.kind === 'if') f.out = f.node.else;
    } else {
      // Close the nearest matching block; anything left open inside it closes with it.
      const want = op === '/each' ? 'each' : 'if';
      const at = stack.map((f) => f.open).lastIndexOf(want);
      if (at > 0) stack.length = at;
    }
  }
  if (last < tpl.length) top().out.push({ kind: 'text', text: tpl.slice(last) });
  return root;
}

/** `{{#if}}` truthiness: non-blank text, a non-zero finite number, `true`, or a non-empty list. */
export function isTruthy(v: unknown): boolean {
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return Number.isFinite(v) && v !== 0;
  if (typeof v === 'boolean') return v;
  if (Array.isArray(v)) return v.length > 0;
  return false;
}
