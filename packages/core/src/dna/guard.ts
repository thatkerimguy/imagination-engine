// Zero-dependency Book Visual DNA parser (the reader receives DNA inside chapter / preview
// payloads and must never pull in Zod). Strict: every axis and enum value is checked.
import {
  ATMOSPHERES,
  FONT_VOICES,
  MOTION_PERSONALITIES,
  ORNAMENT_GRAMMARS,
  RADII,
  SONIC_TIMBRES,
  SURFACE_MATERIALS,
  TRACKINGS,
  type BookVisualDna,
} from './types.ts';

export type DnaResult = { ok: true; dna: BookVisualDna } | { ok: false; errors: string[] };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

export function parseVisualDna(raw: unknown): DnaResult {
  const errors: string[] = [];
  const axis = (name: string): Obj => {
    const v = isObj(raw) ? raw[name] : undefined;
    if (!isObj(v)) errors.push(`${name}: expected an object`);
    return isObj(v) ? v : {};
  };
  const num = (o: Obj, path: string, k: string, lo: number, hi: number): void => {
    const v = o[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi)
      errors.push(`${path}.${k}: expected a number in ${lo}..${hi}`);
  };
  const oneOf = (o: Obj, path: string, k: string, values: readonly string[]): void => {
    if (!values.includes(o[k] as string))
      errors.push(`${path}.${k}: not one of ${values.join('|')}`);
  };
  if (!isObj(raw)) return { ok: false, errors: ['(root): expected an object'] };

  const pal = axis('palette');
  num(pal, 'palette', 'hue', 0, 360);
  num(pal, 'palette', 'chroma', 0, 0.37);
  num(pal, 'palette', 'warmth', -1, 1);
  num(pal, 'palette', 'secondaryHue', 0, 360);
  oneOf(pal, 'palette', 'contrastMode', ['balanced', 'high']);
  const ty = axis('typography');
  for (const k of ['display', 'prose', 'diegetic']) oneOf(ty, 'typography', k, FONT_VOICES);
  oneOf(ty, 'typography', 'tracking', TRACKINGS);
  const su = axis('surface');
  oneOf(su, 'surface', 'material', SURFACE_MATERIALS);
  num(su, 'surface', 'grainIntensity', 0, 1);
  const or = axis('ornament');
  oneOf(or, 'ornament', 'grammar', ORNAMENT_GRAMMARS);
  oneOf(or, 'ornament', 'radius', RADII);
  num(or, 'ornament', 'strokeWidth', 0.5, 4);
  const mo = axis('motion');
  oneOf(mo, 'motion', 'personality', MOTION_PERSONALITIES);
  num(mo, 'motion', 'tempo', 0.5, 2);
  const at = axis('atmosphere');
  oneOf(at, 'atmosphere', 'style', ATMOSPHERES);
  num(at, 'atmosphere', 'intensity', 0, 1);
  const so = axis('sonic');
  oneOf(so, 'sonic', 'timbre', SONIC_TIMBRES);
  num(so, 'sonic', 'gain', 0, 1);

  if (errors.length) return { ok: false, errors };
  const pick = <T>(o: Obj, keys: string[]): T =>
    Object.fromEntries(keys.map((k) => [k, o[k]])) as T;
  return {
    ok: true,
    dna: {
      palette: pick(pal, ['hue', 'chroma', 'warmth', 'secondaryHue', 'contrastMode']),
      typography: pick(ty, ['display', 'prose', 'diegetic', 'tracking']),
      surface: pick(su, ['material', 'grainIntensity']),
      ornament: pick(or, ['grammar', 'radius', 'strokeWidth']),
      motion: pick(mo, ['personality', 'tempo']),
      atmosphere: pick(at, ['style', 'intensity']),
      sonic: pick(so, ['timbre', 'gain']),
    },
  };
}
