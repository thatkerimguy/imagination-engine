// Zero-dependency blueprint guard for the reader. Inline blueprints arrive inside published
// chapter JSON, so the reader re-checks shape + security before handing one to an engine. The
// full Zod validator (validate.ts) runs at authoring time; this is the cheap runtime gate.
import { checkProps } from './props.ts';
import { securityIssues } from './security.ts';
import { isEngineId, type GimmickBlueprint } from './types.ts';

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

export type GuardResult =
  { ok: true; blueprint: GimmickBlueprint } | { ok: false; errors: string[] };

export function guardBlueprint(raw: unknown): GuardResult {
  if (!isObj(raw)) return { ok: false, errors: ['blueprint: expected an object'] };
  const errors: string[] = [];
  const need = (ok: boolean, msg: string): void => void (ok || errors.push(msg));
  need(isStr(raw.id) && SLUG.test(raw.id), 'id: expected a slug');
  need(typeof raw.version === 'number' && raw.version >= 1, 'version: expected a positive int');
  need(isEngineId(raw.engine), 'engine: unknown engine');
  need(isStr(raw.name) && raw.name.length > 0, 'name: required');
  need(Array.isArray(raw.fields) && raw.fields.every(isObj), 'fields: expected a list');
  need(isObj(raw.defaultProps), 'defaultProps: expected an object');
  need(isObj(raw.visual) && isStr(raw.visual.layout), 'visual.layout: required');
  const ex = raw.exports;
  need(
    isObj(ex) && ['transcript', 'summary', 'epubXhtml', 'royalRoadHtml'].every((k) => isStr(ex[k])),
    'exports: all four templates are required',
  );
  if (errors.length) return { ok: false, errors };
  const bp = {
    sampleProps: {},
    mood: [],
    tags: [],
    genre: 'general',
    subgenre: 'general',
    tagline: '',
    tier: 'free',
    ...raw,
  } as unknown as GimmickBlueprint;
  errors.push(...securityIssues(bp));
  errors.push(...checkProps(bp.fields, bp.defaultProps, true).map((e) => `defaultProps.${e}`));
  return errors.length ? { ok: false, errors } : { ok: true, blueprint: bp };
}
