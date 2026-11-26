// Strict validation of an archive's relational tables. Every row is shape-checked and copied to
// its known fields only (unknown fields never reach the database), enums and JSON columns are
// verified, chapter bodies must pass the @kn/core chapter schema and the node tree must be
// cycle-free. Nothing is written here; foreign keys are enforced by `DatabasePort.replaceAll`.
import {
  LINK_RELATIONS,
  MEDIA_KINDS,
  NODE_KINDS,
  parseChapterDocument,
  WORKSPACE_MODES,
  type NodeRecord,
} from '@kn/core';
import type { DatabaseTables } from '../db/port.ts';
import { toChapter } from '../store/node-mapping.ts';
import { fail, isObject, isQuarantineKey, isSecretKey } from './archive-format.ts';

type Spec = 's' | 's?' | 'n' | 'b';
type Shape = Readonly<Record<string, Spec>>;

const SHAPES = {
  nodes: {
    id: 's',
    kind: 's',
    parentId: 's?',
    bookId: 's?',
    title: 's',
    subtitle: 's?',
    position: 'n',
    workspaceMode: 's?',
    coverAssetId: 's?',
    locked: 'b',
    deletedAt: 's?',
    wordCount: 'n',
    createdAt: 's',
    updatedAt: 's',
    metaJson: 's?',
  },
  nodeBodies: { nodeId: 's', blocksJson: 's', plainText: 's', updatedAt: 's' },
  nodeLinks: { sourceId: 's', targetId: 's', relation: 's', createdAt: 's' },
  growthLogs: {
    id: 's',
    nodeId: 's',
    bookId: 's?',
    dateKey: 's',
    wordCount: 'n',
    isBaseline: 'b',
    recordedAt: 's',
    chars: 'n',
    sentences: 'n',
    paragraphs: 'n',
  },
  mediaAssets: {
    id: 's',
    kind: 's',
    relativePath: 's',
    mimeType: 's',
    width: 'n',
    height: 'n',
    bytes: 'n',
    createdAt: 's',
  },
  settings: { key: 's', valueJson: 's', updatedAt: 's' },
  gimmickPacks: { id: 's', genre: 's', title: 's', version: 'n', metaJson: 's?', createdAt: 's' },
  gimmickBlueprints: {
    id: 's',
    packId: 's',
    engine: 's',
    genre: 's',
    title: 's',
    configJson: 's',
    createdAt: 's',
  },
} as const satisfies Record<keyof DatabaseTables, Shape>;

const specOk = (spec: Spec, v: unknown): boolean =>
  spec === 's'
    ? typeof v === 'string'
    : spec === 's?'
      ? v === null || typeof v === 'string'
      : spec === 'n'
        ? typeof v === 'number' && Number.isFinite(v)
        : typeof v === 'boolean';

function rowsOf<K extends keyof DatabaseTables>(table: K, raw: unknown): DatabaseTables[K] {
  if (raw === undefined) return [] as unknown as DatabaseTables[K];
  if (!Array.isArray(raw)) return fail(`Table "${table}" is not a list.`);
  const shape: Shape = SHAPES[table];
  const out = raw.map((row, i): Record<string, unknown> => {
    if (!isObject(row)) return fail(`Table "${table}": row ${i + 1} is malformed.`);
    const copy: Record<string, unknown> = {};
    for (const [field, spec] of Object.entries(shape)) {
      const v = row[field] === undefined && spec === 's?' ? null : row[field];
      if (!specOk(spec, v)) return fail(`Table "${table}": row ${i + 1} has a bad "${field}".`);
      copy[field] = v;
    }
    return copy;
  });
  return out as unknown as DatabaseTables[K];
}

const validJson = (s: string): boolean => {
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
};

function unique(table: string, ids: readonly string[]): void {
  if (ids.some((id) => !id || id.length > 200)) fail(`Table "${table}" has an empty or huge id.`);
  if (new Set(ids).size !== ids.length) fail(`Table "${table}" has duplicate ids.`);
}

const SAFE_SETTING_KEY = /^[A-Za-z0-9_./:#-]{1,300}$/;
const unsafePath = (p: string): boolean =>
  p.length > 1024 || p.includes('\\') || p.split('/').includes('..');

function checkTree(nodes: readonly NodeRecord[]): void {
  const parent = new Map(nodes.map((n) => [n.id, n.parentId]));
  for (const n of nodes) {
    let at: string | null = n.parentId;
    for (let hops = 0; at !== null && parent.has(at); hops++) {
      if (at === n.id || hops > nodes.length) fail(`Node "${n.id}" is part of a cycle.`);
      at = parent.get(at) ?? null;
    }
  }
}

function checkNodes(t: DatabaseTables): void {
  unique(
    'nodes',
    t.nodes.map((n) => n.id),
  );
  for (const n of t.nodes) {
    if (!(NODE_KINDS as readonly string[]).includes(n.kind)) fail(`Unknown node kind "${n.kind}".`);
    if (
      n.workspaceMode !== null &&
      !(WORKSPACE_MODES as readonly string[]).includes(n.workspaceMode)
    )
      fail(`Node "${n.id}" has an unknown workspace mode.`);
    if (n.metaJson !== null && !validJson(n.metaJson)) fail(`Node "${n.id}" has corrupted meta.`);
  }
  checkTree(t.nodes);
  const byId = new Map(t.nodes.map((n) => [n.id, n]));
  unique(
    'node_bodies',
    t.nodeBodies.map((b) => b.nodeId),
  );
  for (const b of t.nodeBodies) {
    let blocks: unknown;
    try {
      blocks = JSON.parse(b.blocksJson);
    } catch {
      return fail(`The text of "${b.nodeId}" is corrupted (not valid JSON).`);
    }
    if (!Array.isArray(blocks)) fail(`The text of "${b.nodeId}" is malformed.`);
    const node = byId.get(b.nodeId);
    if (node?.kind === 'chapter') {
      const r = parseChapterDocument(toChapter(node, b));
      if (!r.ok) fail(`Chapter "${node.id}": ${r.errors.join('; ')}`);
    }
  }
  for (const l of t.nodeLinks)
    if (!(LINK_RELATIONS as readonly string[]).includes(l.relation))
      fail('A link has an unknown relation.');
}

function checkRest(t: DatabaseTables): void {
  unique(
    'growth_logs',
    t.growthLogs.map((g) => g.id),
  );
  unique(
    'media_assets',
    t.mediaAssets.map((m) => m.id),
  );
  for (const m of t.mediaAssets) {
    if (!(MEDIA_KINDS as readonly string[]).includes(m.kind))
      fail(`Unknown media kind "${m.kind}".`);
    if (unsafePath(m.relativePath)) fail(`Unsafe media path for "${m.id}".`);
  }
  unique(
    'settings',
    t.settings.map((s) => s.key),
  );
  for (const s of t.settings) {
    if (!SAFE_SETTING_KEY.test(s.key)) fail(`"${s.key}" is not a setting this app can restore.`);
    if (isSecretKey(s.key) || isQuarantineKey(s.key))
      fail(`"${s.key}" is not a setting this app can restore.`);
    if (!validJson(s.valueJson)) fail(`"${s.key}" is corrupted (not valid JSON).`);
  }
  unique(
    'gimmick_packs',
    t.gimmickPacks.map((p) => p.id),
  );
  unique(
    'gimmick_blueprints',
    t.gimmickBlueprints.map((p) => p.id),
  );
}

/** Validates raw parsed table JSON (missing tables are empty). Throws a readable error. */
export function validateTables(
  raw: Partial<Record<keyof DatabaseTables, unknown>>,
): DatabaseTables {
  const t: DatabaseTables = {
    nodes: rowsOf('nodes', raw.nodes),
    nodeBodies: rowsOf('nodeBodies', raw.nodeBodies),
    nodeLinks: rowsOf('nodeLinks', raw.nodeLinks),
    growthLogs: rowsOf('growthLogs', raw.growthLogs),
    mediaAssets: rowsOf('mediaAssets', raw.mediaAssets),
    settings: rowsOf('settings', raw.settings),
    gimmickPacks: rowsOf('gimmickPacks', raw.gimmickPacks),
    gimmickBlueprints: rowsOf('gimmickBlueprints', raw.gimmickBlueprints),
  };
  checkNodes(t);
  checkRest(t);
  return t;
}
