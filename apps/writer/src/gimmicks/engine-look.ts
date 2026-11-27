// Feather glyph per gimmick engine (v2 blueprints), used by catalog rows, miniatures and pills.
import type { EngineId } from '@kn/core/gimmicks';
import type { GlyphName } from '../ui/Glyph.tsx';

const GLYPHS: Readonly<Record<EngineId, GlyphName>> = {
  'frame-hud': 'layout',
  'chat-thread': 'message-circle',
  'text-alchemy': 'type',
  'artifact-doc': 'file-text',
  'tactile-reveal': 'unlock',
  'telemetry-meter': 'activity',
  'kinetic-prose': 'wind',
  'margin-note': 'edit-3',
  'spatial-layout': 'columns',
  'screen-fx': 'aperture',
  'particle-field': 'star',
  'audio-bed': 'headphones',
  'audio-stinger': 'volume-2',
  'bespoke-3d': 'box',
};

export const engineGlyph = (engine: string): GlyphName => GLYPHS[engine as EngineId] ?? 'zap';
