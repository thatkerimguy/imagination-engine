export { AMBIENTS, TitleActor, type Rgb } from './actors.ts';
export {
  BASE_CHARS,
  GlyphAtlas,
  ShelfPacker,
  type AtlasGlyph,
  type AtlasOptions,
} from './atlas.ts';
export { gpuRenderer, StageDirector, stageColor, type StageDirectorOptions } from './director.ts';
export { MAX_FLASHES_PER_SECOND, ScreenFx, type FxState } from './fx.ts';
export { createStageModule, STAGE_DIRECTOR } from './module.ts';
export {
  PARTICLE_PRESETS,
  ParticleSystem,
  random,
  type ParticlePreset,
  type ParticleSpec,
} from './particles.ts';
export { distanceTransform, sdfFromCoverage } from './sdf.ts';
export { Stage, type StageOptions, type StagePalette, type StageStats } from './stage.ts';
export { layoutText, type LayoutOptions, type Metrics, type PlacedGlyph } from './text.ts';
export {
  detectTier,
  FrameGovernor,
  TIERS,
  type GpuInfo,
  type QualityTier,
  type TierName,
} from './tiers.ts';
export { parseCssColor } from './color.ts';
export { createStageHost, themePalette, type StageHostOptions } from './host.ts';
export { createPen, type StageLayer, type StagePen } from './layer.ts';
