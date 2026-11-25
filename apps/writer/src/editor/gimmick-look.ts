// Visual vocabulary for gimmick cue strips: Feather glyph and accent colour per module.
import type { ModuleMeta } from '@kn/core';
import type { GlyphName } from '../ui/Glyph.tsx';
import { mix, type FolioColors } from '../ui/palette.ts';
import type { InkRole } from '../ui/Txt.tsx';

/** Muted plum hue for psych-thriller cues, softened toward each theme's secondary ink. */
const PSYCH_PLUM = '#A0527A';

/** Feather glyph for a module id; falls back to `zap`. */
export function gimmickGlyph(id: string): GlyphName {
  if (id.includes('ambient') || id.includes('ambience')) return 'cloud-rain';
  if (id.includes('cyberbrain') || id.includes('chat')) return 'cpu';
  if (id.includes('dice')) return 'box';
  if (id.includes('gaslight')) return 'eye-off';
  if (id.includes('ghost') || id.includes('whisper')) return 'radio';
  if (id.includes('lighter')) return 'sun';
  return 'zap';
}

/** Left-bar colour role by render layer: inline accent, overlay warm, audio/haptic slate. */
export function layerRole(layer: ModuleMeta['layer']): InkRole {
  if (layer === 'overlay-vfx') return 'warm';
  if (layer === 'audio-haptic') return 'inkMuted';
  return 'accent';
}

/**
 * Cue-strip bar + glyph colour. Psych-thriller gets its own muted plum (mixed toward the theme's
 * secondary ink, so it stays legible in every light, dark and Material You theme); every other
 * genre keeps its render-layer role.
 */
export function gimmickColor(
  meta: Pick<ModuleMeta, 'genre' | 'layer'>,
  colors: FolioColors,
): `#${string}` {
  const c =
    meta.genre === 'psych-thriller'
      ? mix(PSYCH_PLUM, colors.inkSecondary, 0.6)
      : colors[layerRole(meta.layer)];
  return c as `#${string}`;
}
