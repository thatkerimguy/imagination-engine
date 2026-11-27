// Static engine switch: one explicit dynamic import() per engine, so Vite splits each engine into
// its own lazy chunk and nothing is discovered by glob. The 7 OVERHAUL-04 engines resolve to a
// calm placeholder. Three v1 modules stay as temporary static lazy arms until OVERHAUL-04
// replaces them with `audio-bed` and `bespoke-3d`.
import type { ModuleCardFormatter, ModuleSchemaDefinition } from '@kn/core';
import type { EngineId, GimmickEngine } from '@kn/core/gimmicks';
import type { ModuleRendererFactory } from '@kn/core/renderer';

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
    case 'spatial-layout':
    case 'screen-fx':
    case 'particle-field':
    case 'audio-bed':
    case 'audio-stinger':
    case 'bespoke-3d':
      return placeholderEngine(id);
  }
}

/** Calm, readable stand-in for an engine that ships in OVERHAUL-04 (never an error). */
function placeholderEngine(id: EngineId): GimmickEngine {
  return {
    id,
    mount(host, blueprint) {
      const p = document.createElement('p');
      p.className = 'kn-module-notice';
      p.dataset.engine = id;
      p.textContent = `${blueprint.name}: this spectacle arrives in a later reader update.`;
      host.append(p);
      return { trigger: () => Promise.resolve(), destroy: () => p.remove() };
    },
  };
}

// ---- Temporary v1 arms (Chrome Tide), retired in OVERHAUL-04 -------------------------------

export type AnyProps = Record<string, unknown>;

export interface ModuleEntry {
  schema: ModuleSchemaDefinition<AnyProps>;
  formatCardSummary: ModuleCardFormatter<AnyProps>;
}

export const LEGACY_MODULE_IDS = ['bl-dice-3d', 'bl-lighter-flick', 'core-ambient-bed'] as const;
export type LegacyModuleId = (typeof LEGACY_MODULE_IDS)[number];

export const isLegacyModule = (id: string): id is LegacyModuleId =>
  (LEGACY_MODULE_IDS as readonly string[]).includes(id);

type Loaded<T> = Promise<T | null>;

export async function loadModuleEntry(id: string): Loaded<ModuleEntry> {
  const pick = (m: unknown): ModuleEntry => m as ModuleEntry;
  switch (id) {
    case 'bl-dice-3d':
      return pick(await import('../../../packages/modules/bl-dice-3d/index.ts'));
    case 'bl-lighter-flick':
      return pick(await import('../../../packages/modules/bl-lighter-flick/index.ts'));
    case 'core-ambient-bed':
      return pick(await import('../../../packages/modules/core-ambient-bed/index.ts'));
    default:
      return null;
  }
}

export async function loadRendererFactory(id: string): Loaded<ModuleRendererFactory<AnyProps>> {
  const pick = (m: { default: unknown }): ModuleRendererFactory<AnyProps> =>
    m.default as ModuleRendererFactory<AnyProps>;
  switch (id) {
    case 'bl-dice-3d':
      return pick(await import('../../../packages/modules/bl-dice-3d/renderer.ts'));
    case 'bl-lighter-flick':
      return pick(await import('../../../packages/modules/bl-lighter-flick/renderer.ts'));
    case 'core-ambient-bed':
      return pick(await import('../../../packages/modules/core-ambient-bed/renderer.ts'));
    default:
      return null;
  }
}
