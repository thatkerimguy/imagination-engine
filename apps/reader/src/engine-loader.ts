// Static engine switch: one explicit dynamic import() per engine, so Vite splits each of the 14
// engines into its own lazy chunk and nothing is discovered by glob. three.js / cannon-es are
// reachable only through `bespoke-3d`. There are no v1 module arms: every cue is a v2 blueprint.
import type { EngineId, GimmickEngine } from '@kn/core/gimmicks';

export async function loadEngine(id: EngineId): Promise<GimmickEngine> {
  switch (id) {
    case 'frame-hud':
      return (await import('@kn/engines/frame-hud')).frameHudEngine;
    case 'chat-thread':
      return (await import('@kn/engines/chat-thread')).chatThreadEngine;
    case 'text-alchemy':
      return (await import('@kn/engines/text-alchemy')).textAlchemyEngine;
    case 'artifact-doc':
      return (await import('@kn/engines/artifact-doc')).artifactDocEngine;
    case 'tactile-reveal':
      return (await import('@kn/engines/tactile-reveal')).tactileRevealEngine;
    case 'telemetry-meter':
      return (await import('@kn/engines/telemetry-meter')).telemetryMeterEngine;
    case 'kinetic-prose':
      return (await import('@kn/engines/kinetic-prose')).kineticProseEngine;
    case 'margin-note':
      return (await import('@kn/engines/margin-note')).marginNoteEngine;
    case 'spatial-layout':
      return (await import('@kn/engines/spatial-layout')).spatialLayoutEngine;
    case 'screen-fx':
      return (await import('@kn/engines/screen-fx')).screenFxEngine;
    case 'particle-field':
      return (await import('@kn/engines/particle-field')).particleFieldEngine;
    case 'audio-bed':
      return (await import('@kn/engines/audio-bed')).audioBedEngine;
    case 'audio-stinger':
      return (await import('@kn/engines/audio-stinger')).audioStingerEngine;
    case 'bespoke-3d':
      return (await import('@kn/engines/bespoke-3d')).bespoke3dEngine;
  }
}
