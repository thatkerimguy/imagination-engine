// Module discovery. Every folder in packages/modules/ is found at build time and split into its
// own lazy chunks, so adding or deleting a module needs no edit here, in core, or in the writer.
import type { ModuleCardFormatter, ModuleSchemaDefinition } from '@kn/core';
import type { ModuleRendererFactory } from '@kn/core/renderer';

export type AnyProps = Record<string, unknown>;

export interface ModuleEntry {
  schema: ModuleSchemaDefinition<AnyProps>;
  formatCardSummary: ModuleCardFormatter<AnyProps>;
}

const entries = import.meta.glob<ModuleEntry>('../../../../packages/modules/*/index.ts');
const renderers = import.meta.glob<{ default: ModuleRendererFactory<AnyProps> }>(
  '../../../../packages/modules/*/renderer.ts',
);

const idOf = (path: string): string => /modules\/([^/]+)\//.exec(path)?.[1] ?? path;
const byId = <T>(map: Record<string, () => Promise<T>>): Map<string, () => Promise<T>> =>
  new Map(Object.entries(map).map(([path, load]) => [idOf(path), load]));

const entryLoaders = byId(entries);
const rendererLoaders = byId(renderers);

export function registeredModuleIds(): string[] {
  return [...entryLoaders.keys()].filter((id) => rendererLoaders.has(id)).sort();
}

export async function loadModuleEntry(id: string): Promise<ModuleEntry | null> {
  const load = entryLoaders.get(id);
  if (!load) return null;
  const entry = await load();
  if (entry.schema.meta.id !== id) {
    console.warn(
      `[registry] ${id}: meta.id is "${entry.schema.meta.id}", expected the folder name`,
    );
    return null;
  }
  return entry;
}

export async function loadRendererFactory(
  id: string,
): Promise<ModuleRendererFactory<AnyProps> | null> {
  const load = rendererLoaders.get(id);
  return load ? (await load()).default : null;
}
