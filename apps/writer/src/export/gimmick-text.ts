// How a gimmick cue reads outside the reader (read-aloud, DOCX, PDF, EPUB 3, Markdown, TXT,
// Royal Road). Every v2 cue is rendered from its blueprint's own `exports` templates through
// `renderBlueprintExport` — there are no per-gimmick branches, so blueprint #500 exports with
// zero code. Pre-v2 module blocks (no `blueprintId`) fall back to the writer registry's card.
import type { ModuleBlock } from '@kn/core';
import {
  guardBlueprint,
  renderBlueprintExport,
  resolveBlueprintProps,
  type BlueprintProps,
  type ExportFormat as TemplateFormat,
  type GimmickBlueprint,
} from '@kn/core/gimmicks';
import { starterBlueprint } from '@kn/engines/blueprints';
import { getWriterModule } from '../modules/registry.ts';
import type { GimmickMode } from './book-model.ts';

/** One printed line. `text` is plain (not markup). */
export interface CueLine {
  text: string;
  speaker?: string;
  italic?: boolean;
}

export type InlineBlueprints = Readonly<Record<string, unknown>> | undefined;

/** The cue's blueprint: the chapter's inline copy (re-guarded) first, then the starter pack. */
export function cueBlueprint(block: ModuleBlock, inline?: InlineBlueprints): GimmickBlueprint | null {
  const id = block.props.blueprintId;
  if (typeof id !== 'string') return null;
  const own = inline?.[id];
  if (own !== undefined) {
    const g = guardBlueprint(own);
    if (g.ok) return g.blueprint;
  }
  return starterBlueprint(id);
}

/** Field values merged over the blueprint defaults (invalid props fall back to the defaults). */
function cueProps(bp: GimmickBlueprint, block: ModuleBlock): BlueprintProps {
  const rest = { ...block.props };
  delete rest.blueprintId;
  const r = resolveBlueprintProps(bp, rest);
  return r.ok ? r.props : bp.defaultProps;
}

/** A cue rendered through one of its blueprint's export templates (null for a pre-v2 block). */
export function renderCue(
  block: ModuleBlock,
  format: TemplateFormat,
  inline?: InlineBlueprints,
): { blueprint: GimmickBlueprint; text: string } | null {
  const bp = cueBlueprint(block, inline);
  return bp ? { blueprint: bp, text: renderBlueprintExport(bp, cueProps(bp, block), format) } : null;
}

function legacyCard(block: ModuleBlock): { name: string; detail: string } {
  const mod = getWriterModule(block.moduleId);
  if (!mod) return { name: block.moduleId, detail: 'Unknown gimmick' };
  try {
    const card = mod.summarize(block.props);
    return { name: mod.meta.name, detail: card.subtitle || card.title };
  } catch {
    return { name: mod.meta.name, detail: 'Gimmick' };
  }
}

/** The lines a cue contributes under `mode`. */
export function gimmickLines(
  block: ModuleBlock,
  mode: GimmickMode,
  inline?: InlineBlueprints,
): CueLine[] {
  if (mode === 'omit') return [];
  if (mode === 'summary') {
    const r = renderCue(block, 'summary', inline);
    if (r) return [{ text: `[${r.blueprint.name}: ${r.text || r.blueprint.tagline}]` }];
    const { name, detail } = legacyCard(block);
    return [{ text: `[${name}: ${detail}]` }];
  }
  const r = renderCue(block, 'transcript', inline);
  if (!r) {
    const { name, detail } = legacyCard(block);
    return [{ text: `${name}: ${detail}`, italic: true }];
  }
  const lines = r.text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((text) => ({ text }));
  return lines.length ? lines : [{ text: r.blueprint.name, italic: true }];
}
