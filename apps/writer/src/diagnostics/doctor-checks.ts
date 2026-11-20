// Runs every Document Doctor check over the parsed entries.
import { checkModules, checkSidecars, checkUris } from './doctor-content.ts';
import { checkFolders, checkTree, type Tree } from './doctor-links.ts';
import type { Entry, Issue, ModuleLookup, ScanOptions } from './doctor-types.ts';

export async function checkContent(
  entries: readonly Entry[],
  opts: ScanOptions & { getModule: (id: string) => ModuleLookup | undefined },
): Promise<Issue[]> {
  const tree: Tree = {
    keys: new Set(entries.map((e) => e.key)),
    byPrefix: (prefix) => entries.filter((e) => e.key.startsWith(prefix)),
  };
  return [
    ...checkTree(entries, tree),
    ...checkFolders(entries, tree),
    ...checkModules(entries, opts.getModule),
    ...checkSidecars(entries, tree),
    ...(await checkUris(entries, opts)),
  ];
}
