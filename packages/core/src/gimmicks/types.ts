// Gimmick System v2 contract types. Zero dependencies: the reader imports these freely.
// Blueprints are declarative, non-executable JSON that pick one of the 14 engines and configure
// it (author form, visual/motion/audio recipe, export templates). Never code.
import type { OrnamentGrammar, SurfaceMaterial } from '../dna/types.ts';

export const ENGINE_IDS = [
  'frame-hud',
  'chat-thread',
  'text-alchemy',
  'artifact-doc',
  'tactile-reveal',
  'telemetry-meter',
  'kinetic-prose',
  'margin-note',
  'spatial-layout',
  'screen-fx',
  'particle-field',
  'audio-bed',
  'audio-stinger',
  'bespoke-3d',
] as const;
export type EngineId = (typeof ENGINE_IDS)[number];

/** Engines shipped in OVERHAUL-03; the other 7 render a calm placeholder until OVERHAUL-04. */
export const LIVE_ENGINE_IDS = [
  'frame-hud',
  'chat-thread',
  'text-alchemy',
  'artifact-doc',
  'tactile-reveal',
  'telemetry-meter',
  'kinetic-prose',
] as const satisfies readonly EngineId[];
export type LiveEngineId = (typeof LIVE_ENGINE_IDS)[number];

export const isEngineId = (v: unknown): v is EngineId =>
  typeof v === 'string' && (ENGINE_IDS as readonly string[]).includes(v);

export const ACCENT_ROLES = ['primary', 'secondary', 'warning', 'success', 'neutral'] as const;
export const BORDER_STYLES = ['none', 'hairline', 'double', 'dashed', 'glow'] as const;
export const MOTION_PRESETS = [
  'none',
  'fade',
  'rise',
  'sweep',
  'type',
  'decrypt',
  'stamp',
  'pulse',
] as const;
export const HAPTIC_PATTERNS = ['none', 'tap', 'pulse', 'heavy', 'double'] as const;
export const STINGER_PATCHES = [
  'chime',
  'click',
  'seal-crack',
  'beep',
  'type-key',
  'paper-rustle',
  'pulse',
] as const;

export type AccentRole = (typeof ACCENT_ROLES)[number];
export type BorderStyle = (typeof BORDER_STYLES)[number];
export type MotionPreset = (typeof MOTION_PRESETS)[number];
export type HapticPattern = (typeof HAPTIC_PATTERNS)[number];
export type StingerPatch = (typeof STINGER_PATCHES)[number];

export interface SelectOption {
  value: string;
  label: string;
}

interface FieldBase {
  /** camelCase prop key. */
  key: string;
  label: string;
  help?: string;
  /** Optional fields may be absent from props (e.g. `threshold`, `emphasisWord`). */
  optional?: boolean;
}

/** One column of a `records` field (object arrays such as chat messages or meter items). */
export interface RecordColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: SelectOption[];
  optional?: boolean;
}

export type BlueprintFieldSpec =
  | (FieldBase & { type: 'text' | 'multiline'; maxLength?: number; placeholder?: string })
  | (FieldBase & { type: 'list'; minItems?: number; maxItems?: number; itemLabel?: string })
  | (FieldBase & {
      type: 'records';
      columns: RecordColumn[];
      minItems?: number;
      maxItems?: number;
      itemLabel?: string;
    })
  | (FieldBase & { type: 'select'; options: SelectOption[] })
  | (FieldBase & { type: 'number'; min: number; max: number; step: number; unit?: string })
  | (FieldBase & { type: 'boolean' })
  | (FieldBase & { type: 'color' });

export type BlueprintFieldType = BlueprintFieldSpec['type'];
export type BlueprintRecord = Record<string, string | number>;
export type BlueprintPropValue = string | number | boolean | string[] | BlueprintRecord[];
export type BlueprintProps = Record<string, BlueprintPropValue>;

export interface BlueprintVisual {
  /** Engine-specific variant, e.g. frame-hud `system` / `decree`. */
  layout: string;
  /** `inherit` follows the book's Visual DNA ornament grammar. */
  ornament: OrnamentGrammar | 'inherit';
  surface?: SurfaceMaterial | 'inherit';
  accentRole: AccentRole;
  borderStyle: BorderStyle;
  motionPreset: MotionPreset;
}

export interface BlueprintExports {
  transcript: string;
  summary: string;
  epubXhtml: string;
  royalRoadHtml: string;
}
export type ExportFormat = keyof BlueprintExports;

export interface GimmickBlueprint {
  // Discovery
  id: string;
  version: number;
  engine: EngineId;
  genre: string;
  subgenre: string;
  mood: string[];
  tags: string[];
  name: string;
  tagline: string;
  tier: 'free' | 'pro';
  // Author form contract
  fields: BlueprintFieldSpec[];
  defaultProps: BlueprintProps;
  sampleProps: BlueprintProps;
  // Visual / motion / audio recipe
  visual: BlueprintVisual;
  sound?: { patch: StingerPatch; gain?: number; pitchShift?: number };
  haptics?: HapticPattern;
  // Universal export templates
  exports: BlueprintExports;
}
