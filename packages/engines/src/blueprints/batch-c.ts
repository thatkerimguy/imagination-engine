// Starter v2 blueprints, batch C: margin-note, spatial-layout, screen-fx, particle-field,
// audio-bed, audio-stinger (2 each). Pure data: each folder's blueprints.ts holds the records.
import type { GimmickBlueprint } from '@kn/core/gimmicks';
import { AUDIO_BED_BLUEPRINTS } from '../audio-bed/blueprints.ts';
import { AUDIO_STINGER_BLUEPRINTS } from '../audio-stinger/blueprints.ts';
import { MARGIN_NOTE_BLUEPRINTS } from '../margin-note/blueprints.ts';
import { PARTICLE_FIELD_BLUEPRINTS } from '../particle-field/blueprints.ts';
import { SCREEN_FX_BLUEPRINTS } from '../screen-fx/blueprints.ts';
import { SPATIAL_LAYOUT_BLUEPRINTS } from '../spatial-layout/blueprints.ts';

export const BATCH_C: GimmickBlueprint[] = [
  ...MARGIN_NOTE_BLUEPRINTS,
  ...SPATIAL_LAYOUT_BLUEPRINTS,
  ...SCREEN_FX_BLUEPRINTS,
  ...PARTICLE_FIELD_BLUEPRINTS,
  ...AUDIO_BED_BLUEPRINTS,
  ...AUDIO_STINGER_BLUEPRINTS,
];
