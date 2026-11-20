// Zero-dependency Myers O(ND) line diff (with common prefix/suffix trimming) used by version
// history to show what changed between a checkpoint and the current draft. Pure TS.
import { stripInlineMarkup } from '../editor/inline-markup.ts';

export type DiffOp = 'equal' | 'insert' | 'delete';
export interface Hunk {
  op: DiffOp;
  lines: string[];
}

function pushLine(out: Hunk[], op: DiffOp, line: string): void {
  const last = out[out.length - 1];
  if (last && last.op === op) last.lines.push(line);
  else out.push({ op, lines: [line] });
}

/** Myers shortest edit script of the (already trimmed) middle; ops returned in order. */
function myers(a: readonly string[], b: readonly string[]): { op: DiffOp; line: string }[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const v = new Int32Array(2 * max + 2);
  const trace: Int32Array[] = [];
  let found = -1;
  for (let d = 0; d <= max && found < 0; d++) {
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && (v[max + k - 1] ?? 0) < (v[max + k + 1] ?? 0))) {
        x = v[max + k + 1] ?? 0;
      } else {
        x = (v[max + k - 1] ?? 0) + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[max + k] = x;
      if (x >= n && y >= m) found = d;
    }
    trace.push(v.slice(max - d, max + d + 1));
  }
  const rev: { op: DiffOp; line: string }[] = [];
  let x = n;
  let y = m;
  for (let d = found; d > 0; d--) {
    const prev = trace[d - 1] as Int32Array;
    const off = d - 1;
    const k = x - y;
    const down = k === -d || (k !== d && (prev[off + k - 1] ?? 0) < (prev[off + k + 1] ?? 0));
    const prevK = down ? k + 1 : k - 1;
    const prevX = prev[off + prevK] ?? 0;
    const prevY = prevX - prevK;
    const midX = down ? prevX : prevX + 1;
    const midY = down ? prevY + 1 : prevY;
    while (x > midX && y > midY) {
      x--;
      y--;
      rev.push({ op: 'equal', line: a[x] as string });
    }
    if (down) rev.push({ op: 'insert', line: b[prevY] as string });
    else rev.push({ op: 'delete', line: a[prevX] as string });
    x = prevX;
    y = prevY;
  }
  while (x > 0 && y > 0) {
    x--;
    y--;
    rev.push({ op: 'equal', line: a[x] as string });
  }
  return rev.reverse();
}

/** Line diff from `a` to `b`; adjacent lines with the same op are merged into one hunk. */
export function diffLines(a: readonly string[], b: readonly string[]): Hunk[] {
  if (a.length === b.length && a.every((l, i) => l === b[i])) {
    return a.length === 0 ? [] : [{ op: 'equal', lines: [...a] }];
  }
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const out: Hunk[] = [];
  for (const l of a.slice(0, start)) pushLine(out, 'equal', l);
  for (const e of myers(a.slice(start, endA), b.slice(start, endB))) pushLine(out, e.op, e.line);
  for (const l of a.slice(endA)) pushLine(out, 'equal', l);
  return out;
}

export function diffStats(hunks: readonly Hunk[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const h of hunks) {
    if (h.op === 'insert') added += h.lines.length;
    else if (h.op === 'delete') removed += h.lines.length;
  }
  return { added, removed };
}

/** Readable lines for prose / dialogue / scene-break (and module) blocks: one line per text line. */
export function blocksToLines(blocks: readonly unknown[]): string[] {
  const out: string[] = [];
  for (const raw of blocks) {
    if (!raw || typeof raw !== 'object') continue;
    const b = raw as { kind?: unknown; text?: unknown; speaker?: unknown; moduleId?: unknown };
    if (b.kind === 'scene-break') out.push('* * *');
    else if (b.kind === 'module') out.push(`[Module: ${String(b.moduleId ?? '?')}]`);
    else if (typeof b.text === 'string') {
      const text = stripInlineMarkup(b.text);
      const speaker = b.kind === 'dialogue' && typeof b.speaker === 'string' ? b.speaker : '';
      const lines = text.split('\n');
      lines.forEach((l, i) => out.push(i === 0 && speaker ? `${speaker}: ${l}` : l));
    }
  }
  return out;
}
