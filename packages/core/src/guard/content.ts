// Zero-dependency mirror of schema.ts for the reader (`@kn/core/guard`): same rules, same
// result shape, no Zod in the reader bundle. guard.test.ts proves parity with the Zod schemas.
// Unknown keys are dropped (like Zod's default object parsing); the optional v2 payload keys
// (`visualDna`, `blueprints`) pass through raw and are checked by their own guards.
import { isUlid } from '../ids.ts';
import type {
  Block,
  ChapterDocument,
  NovelManifest,
  ParseResult,
  SeasonManifest,
} from '../schema.ts';

type Obj = Record<string, unknown>;
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const TOKEN = /^--[a-z0-9-]+$/;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

class Check {
  readonly errors: string[] = [];
  constructor(private readonly o: Obj) {}
  private bad(path: string, msg: string): undefined {
    this.errors.push(`${path || '(root)'}: ${msg}`);
    return undefined;
  }
  str(k: string, p: string, opt = false, re?: RegExp, minLen = 0): string | undefined {
    const v = this.o[k];
    if (v === undefined && opt) return undefined;
    if (typeof v !== 'string') return this.bad(p + k, 'Expected string');
    if (v.length < minLen) return this.bad(p + k, 'Too small');
    if (re && !re.test(v)) return this.bad(p + k, 'Invalid format');
    return v;
  }
  oneOf<T extends string>(k: string, p: string, values: readonly T[], opt = false): T | undefined {
    const v = this.o[k];
    if (v === undefined && opt) return undefined;
    if (!values.includes(v as T)) return this.bad(p + k, `Expected one of ${values.join('|')}`);
    return v as T;
  }
  bool(k: string, p: string): boolean | undefined {
    const v = this.o[k];
    if (v === undefined || typeof v === 'boolean') return v;
    return this.bad(p + k, 'Expected boolean');
  }
  slugs(k: string, p: string, min = 0): string[] {
    const v = this.o[k];
    if (!Array.isArray(v)) return this.bad(p + k, 'Expected array') ?? [];
    if (v.length < min) this.bad(p + k, 'Too small');
    v.forEach(
      (s, i) =>
        (typeof s === 'string' && SLUG.test(s)) || this.bad(`${p}${k}.${i}`, 'Expected slug'),
    );
    return v as string[];
  }
}

const defined = <T extends Obj>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

export function checkNovelManifest(raw: unknown): ParseResult<NovelManifest> {
  if (!isObj(raw)) return { ok: false, errors: ['(root): Expected object'] };
  const c = new Check(raw);
  if (raw.schemaVersion !== 1) c.errors.push('schemaVersion: Expected 1');
  const theme = raw.theme;
  if (!isObj(theme)) c.errors.push('theme: Expected record');
  else
    for (const [k, v] of Object.entries(theme)) {
      if (!TOKEN.test(k)) c.errors.push(`theme.${k}: Expected a CSS custom property`);
      if (typeof v !== 'string' || v.length > 120)
        c.errors.push(`theme.${k}: Expected short string`);
    }
  const value = defined({
    schemaVersion: 1 as const,
    id: c.str('id', '', false, SLUG),
    title: c.str('title', '', false, undefined, 1),
    subtitle: c.str('subtitle', '', true),
    author: c.str('author', '', false, undefined, 1),
    sectionLabel: c.oneOf('sectionLabel', '', ['Season', 'Volume', 'Arc'] as const),
    theme: (isObj(theme) ? theme : {}) as Record<string, string>,
    enabledModules: c.slugs('enabledModules', ''),
    seasons: c.slugs('seasons', '', 1),
    visualDna: raw.visualDna,
  });
  return c.errors.length
    ? { ok: false, errors: c.errors }
    : { ok: true, value: value as NovelManifest };
}

export function checkSeasonManifest(raw: unknown): ParseResult<SeasonManifest> {
  if (!isObj(raw)) return { ok: false, errors: ['(root): Expected object'] };
  const c = new Check(raw);
  const value = defined({
    id: c.str('id', '', false, SLUG),
    title: c.str('title', '', false, undefined, 1),
    subtitle: c.str('subtitle', '', true),
    accentColor: c.str('accentColor', '', true, HEX),
    chapters: c.slugs('chapters', ''),
  });
  return c.errors.length
    ? { ok: false, errors: c.errors }
    : { ok: true, value: value as SeasonManifest };
}

function checkBlock(raw: unknown, p: string, errors: string[]): Block | null {
  if (!isObj(raw)) return (errors.push(`${p.slice(0, -1)}: Expected object`), null);
  const c = new Check(raw);
  const id = isUlid(raw.id) ? raw.id : (c.errors.push(`${p}id: Expected a ULID`), undefined);
  const beatStop = c.bool('beatStop', p);
  let block: Obj | null = null;
  switch (raw.kind) {
    case 'prose':
      block = {
        text: c.str('text', p, false, undefined, 1),
        style: c.oneOf('style', p, ['body', 'whisper', 'emphasis'] as const, true),
      };
      break;
    case 'dialogue':
      block = {
        speaker: c.str('speaker', p, false, undefined, 1),
        text: c.str('text', p, false, undefined, 1),
        accentColor: c.str('accentColor', p, true, HEX),
      };
      break;
    case 'scene-break':
      block = { label: c.str('label', p, true), timestamp: c.str('timestamp', p, true) };
      break;
    case 'module': {
      const v = raw.moduleVersion;
      if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0)
        c.errors.push(`${p}moduleVersion: Expected positive int`);
      if (!isObj(raw.props)) c.errors.push(`${p}props: Expected record`);
      block = { moduleId: c.str('moduleId', p, false, SLUG), moduleVersion: v, props: raw.props };
      break;
    }
    default:
      c.errors.push(`${p}kind: Invalid discriminator`);
  }
  errors.push(...c.errors);
  return block ? (defined({ id, kind: raw.kind, ...block, beatStop }) as unknown as Block) : null;
}

export function checkChapterDocument(raw: unknown): ParseResult<ChapterDocument> {
  if (!isObj(raw)) return { ok: false, errors: ['(root): Expected object'] };
  const c = new Check(raw);
  const rawBlocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  if (!Array.isArray(raw.blocks)) c.errors.push('blocks: Expected array');
  const blocks = rawBlocks.map((b, i) => checkBlock(b, `blocks.${i}.`, c.errors));
  const ids = rawBlocks.map((b) => (isObj(b) ? b.id : undefined));
  if (c.errors.length === 0 && new Set(ids).size !== ids.length)
    c.errors.push('(root): Block ids must be unique within a chapter');
  const blueprints = raw.blueprints;
  if (blueprints !== undefined && !isObj(blueprints)) c.errors.push('blueprints: Expected record');
  const value = defined({
    id: c.str('id', '', false, SLUG),
    seasonId: c.str('seasonId', '', false, SLUG),
    title: c.str('title', '', false, undefined, 1),
    status: c.oneOf('status', '', ['draft', 'unlisted', 'published'] as const),
    blocks: blocks.filter((b): b is Block => b !== null),
    visualDna: raw.visualDna,
    blueprints,
  });
  return c.errors.length
    ? { ok: false, errors: c.errors }
    : { ok: true, value: value as unknown as ChapterDocument };
}
