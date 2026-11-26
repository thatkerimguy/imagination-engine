// In-memory full-text index with FTS5 semantics (see fts-query.ts): an inverted index of folded
// tokens → node ids, plus each node's token list for phrase checks. Prefix terms scan the sorted
// unique-token list with a binary search, so 100k words answer in well under a millisecond.
import type { SearchHit } from './port.ts';
import { isEmptyQuery, parseQuery, tokenize } from './fts-query.ts';

interface Doc {
  tokens: string[];
  titleTokens: Set<string>;
  counts: Map<string, number>;
}

export class MemorySearchIndex {
  private readonly docs = new Map<string, Doc>();
  private readonly postings = new Map<string, Set<string>>();
  private sorted: string[] | null = null;

  get size(): number {
    return this.docs.size;
  }

  has(nodeId: string): boolean {
    return this.docs.has(nodeId);
  }

  put(nodeId: string, title: string, plainText: string): void {
    this.remove(nodeId);
    const titleTokens = tokenize(title);
    const tokens = [...titleTokens, ...tokenize(plainText)];
    const counts = new Map<string, number>();
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
    this.docs.set(nodeId, { tokens, titleTokens: new Set(titleTokens), counts });
    for (const t of tokens) {
      let set = this.postings.get(t);
      if (!set) {
        set = new Set();
        this.postings.set(t, set);
        this.sorted = null;
      }
      set.add(nodeId);
    }
  }

  remove(nodeId: string): void {
    const doc = this.docs.get(nodeId);
    if (!doc) return;
    this.docs.delete(nodeId);
    for (const t of doc.counts.keys()) {
      const set = this.postings.get(t);
      set?.delete(nodeId);
      if (set && set.size === 0) {
        this.postings.delete(t);
        this.sorted = null;
      }
    }
  }

  clear(): void {
    this.docs.clear();
    this.postings.clear();
    this.sorted = null;
  }

  /** Unique indexed tokens starting with `prefix` (binary search over the sorted list). */
  private tokensWithPrefix(prefix: string): string[] {
    this.sorted ??= [...this.postings.keys()].sort();
    const list = this.sorted;
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid]! < prefix) lo = mid + 1;
      else hi = mid;
    }
    const out: string[] = [];
    for (let i = lo; i < list.length && list[i]!.startsWith(prefix); i++) out.push(list[i]!);
    return out;
  }

  private idsWith(tokens: readonly string[]): Set<string> {
    const out = new Set<string>();
    for (const t of tokens) for (const id of this.postings.get(t) ?? []) out.add(id);
    return out;
  }

  private hasPhrase(doc: Doc, phrase: readonly string[]): boolean {
    const t = doc.tokens;
    outer: for (let i = 0; i + phrase.length <= t.length; i++) {
      for (let j = 0; j < phrase.length; j++) if (t[i + j] !== phrase[j]) continue outer;
      return true;
    }
    return false;
  }

  search(query: string, limit = 50): SearchHit[] {
    const q = parseQuery(query);
    if (isEmptyQuery(q)) return [];
    let candidates: Set<string> | null = null;
    const narrow = (ids: Set<string>): void => {
      if (!candidates) candidates = ids;
      else for (const id of candidates) if (!ids.has(id)) candidates.delete(id);
    };
    const expanded = q.prefixes.map((p) => this.tokensWithPrefix(p));
    for (const tokens of expanded) narrow(this.idsWith(tokens));
    for (const ph of q.phrases) narrow(new Set(this.postings.get(ph[0]!) ?? []));
    const hits: SearchHit[] = [];
    for (const id of (candidates as Set<string> | null) ?? []) {
      const doc = this.docs.get(id);
      if (!doc || !q.phrases.every((ph) => this.hasPhrase(doc, ph))) continue;
      let score = 0;
      for (const tokens of expanded)
        for (const t of tokens) {
          if (doc.titleTokens.has(t)) score += 10;
          score += doc.counts.get(t) ?? 0;
        }
      hits.push({ nodeId: id, rank: -score / Math.max(1, Math.log2(doc.tokens.length + 1)) });
    }
    hits.sort((a, b) => a.rank - b.rank || a.nodeId.localeCompare(b.nodeId));
    return hits.slice(0, limit);
  }
}
