// Visual vocabulary for gimmick cue strips: Feather glyph and accent role per module.
import type { ModuleMeta } from '@kn/core';
import type { GlyphName } from '../ui/Glyph.tsx';
import type { InkRole } from '../ui/Txt.tsx';

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
