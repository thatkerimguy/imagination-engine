// Relational schema (PRAGMA user_version = 3). v3 adds the Gimmick Catalog FTS index on top of
// the v2 tables; every statement is idempotent, so a v2 database upgrades in place.
// The FTS5 index is kept in sync by triggers, which also fire for ON DELETE CASCADE deletes, so
// every node/body write and every delete updates `nodes_fts` atomically in the same transaction.

export const OPEN_PRAGMAS =
  'PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;';

const FTS_ROW = `SELECT n.rowid, n.id, n.title, COALESCE(b.plain_text, '') FROM nodes n
  LEFT JOIN node_bodies b ON b.node_id = n.id`;

export const SCHEMA_V2 = `
CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cover', 'cover_thumb', 'attachment')),
  relative_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN
    ('book', 'season', 'chapter', 'folder', 'note', 'character', 'location', 'lore')),
  parent_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
  book_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  position REAL NOT NULL DEFAULT 0,
  workspace_mode TEXT CHECK (workspace_mode IN ('prose', 'interactive')),
  cover_asset_id TEXT REFERENCES media_assets(id) ON DELETE SET NULL,
  locked INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  meta_json TEXT
);
CREATE INDEX IF NOT EXISTS nodes_parent_position ON nodes(parent_id, position);
CREATE INDEX IF NOT EXISTS nodes_book_kind ON nodes(book_id, kind);
CREATE INDEX IF NOT EXISTS nodes_deleted_at ON nodes(deleted_at);
CREATE INDEX IF NOT EXISTS nodes_updated_at ON nodes(updated_at);
CREATE TABLE IF NOT EXISTS node_bodies (
  node_id TEXT PRIMARY KEY NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  blocks_json TEXT NOT NULL,
  plain_text TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS node_links (
  source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  relation TEXT NOT NULL CHECK (relation IN ('mention', 'reference')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (source_id, target_id, relation)
);
CREATE INDEX IF NOT EXISTS node_links_target ON node_links(target_id);
CREATE TABLE IF NOT EXISTS growth_logs (
  id TEXT PRIMARY KEY NOT NULL,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  book_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
  date_key TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  chars INTEGER NOT NULL DEFAULT 0,
  sentences INTEGER NOT NULL DEFAULT 0,
  paragraphs INTEGER NOT NULL DEFAULT 0,
  is_baseline INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS growth_logs_node_date ON growth_logs(node_id, date_key);
CREATE INDEX IF NOT EXISTS growth_logs_book ON growth_logs(book_id);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gimmick_packs (
  id TEXT PRIMARY KEY NOT NULL,
  genre TEXT NOT NULL,
  title TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  meta_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS gimmick_packs_genre ON gimmick_packs(genre);
CREATE TABLE IF NOT EXISTS gimmick_blueprints (
  id TEXT PRIMARY KEY NOT NULL,
  pack_id TEXT NOT NULL REFERENCES gimmick_packs(id) ON DELETE CASCADE,
  engine TEXT NOT NULL,
  genre TEXT NOT NULL,
  title TEXT NOT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS gimmick_blueprints_pack ON gimmick_blueprints(pack_id);
CREATE INDEX IF NOT EXISTS gimmick_blueprints_engine ON gimmick_blueprints(engine);
CREATE INDEX IF NOT EXISTS gimmick_blueprints_genre ON gimmick_blueprints(genre);
CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
  node_id UNINDEXED, title, plain_text, tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER IF NOT EXISTS nodes_fts_ai AFTER INSERT ON nodes WHEN new.deleted_at IS NULL BEGIN
  INSERT INTO nodes_fts(rowid, node_id, title, plain_text) ${FTS_ROW} WHERE n.id = new.id;
END;
CREATE TRIGGER IF NOT EXISTS nodes_fts_au AFTER UPDATE ON nodes BEGIN
  DELETE FROM nodes_fts WHERE rowid = old.rowid;
  INSERT INTO nodes_fts(rowid, node_id, title, plain_text) ${FTS_ROW}
    WHERE n.id = new.id AND n.deleted_at IS NULL;
END;
CREATE TRIGGER IF NOT EXISTS nodes_fts_ad AFTER DELETE ON nodes BEGIN
  DELETE FROM nodes_fts WHERE rowid = old.rowid;
END;
CREATE TRIGGER IF NOT EXISTS bodies_fts_ai AFTER INSERT ON node_bodies BEGIN
  DELETE FROM nodes_fts WHERE rowid = (SELECT rowid FROM nodes WHERE id = new.node_id);
  INSERT INTO nodes_fts(rowid, node_id, title, plain_text) ${FTS_ROW}
    WHERE n.id = new.node_id AND n.deleted_at IS NULL;
END;
CREATE TRIGGER IF NOT EXISTS bodies_fts_au AFTER UPDATE ON node_bodies BEGIN
  DELETE FROM nodes_fts WHERE rowid = (SELECT rowid FROM nodes WHERE id = new.node_id);
  INSERT INTO nodes_fts(rowid, node_id, title, plain_text) ${FTS_ROW}
    WHERE n.id = new.node_id AND n.deleted_at IS NULL;
END;
`;

// Catalog discovery columns live inside config_json (the full blueprint), so the triggers read
// them with JSON1; no column migration is needed on top of v2.
const CAT_ROW = `SELECT b.rowid, b.id, COALESCE(json_extract(b.config_json, '$.name'), b.title),
  COALESCE(json_extract(b.config_json, '$.tagline'), ''), b.genre,
  COALESCE(json_extract(b.config_json, '$.subgenre'), ''),
  COALESCE((SELECT group_concat(value, ' ') FROM json_each(b.config_json, '$.tags')), ''),
  COALESCE((SELECT group_concat(value, ' ') FROM json_each(b.config_json, '$.mood')), '')
  FROM gimmick_blueprints b`;
const CAT_COLS = 'rowid, blueprint_id, name, tagline, genre, subgenre, tags, mood';

export const SCHEMA_V3_CATALOG = `
CREATE VIRTUAL TABLE IF NOT EXISTS gimmick_blueprints_fts USING fts5(
  blueprint_id UNINDEXED, name, tagline, genre, subgenre, tags, mood,
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER IF NOT EXISTS gimmick_fts_ai AFTER INSERT ON gimmick_blueprints BEGIN
  INSERT INTO gimmick_blueprints_fts(${CAT_COLS}) ${CAT_ROW} WHERE b.id = new.id;
END;
CREATE TRIGGER IF NOT EXISTS gimmick_fts_au AFTER UPDATE ON gimmick_blueprints BEGIN
  DELETE FROM gimmick_blueprints_fts WHERE rowid = old.rowid;
  INSERT INTO gimmick_blueprints_fts(${CAT_COLS}) ${CAT_ROW} WHERE b.id = new.id;
END;
CREATE TRIGGER IF NOT EXISTS gimmick_fts_ad AFTER DELETE ON gimmick_blueprints BEGIN
  DELETE FROM gimmick_blueprints_fts WHERE rowid = old.rowid;
END;
`;

/** Rebuilds the catalog index (v2 → v3 upgrade, restore). */
export const REBUILD_CATALOG_FTS = `DELETE FROM gimmick_blueprints_fts;
INSERT INTO gimmick_blueprints_fts(${CAT_COLS}) ${CAT_ROW};`;

/** Ranked FTS5 search (title weighted 10×). Params: MATCH expression, limit. */
export const SEARCH_SQL =
  'SELECT node_id, bm25(nodes_fts, 0.0, 10.0, 1.0) AS rank FROM nodes_fts WHERE nodes_fts MATCH ? ORDER BY rank LIMIT ?';

/** Rebuilds the FTS index from scratch (Doctor repair, restore). */
export const REBUILD_FTS = `DELETE FROM nodes_fts;
INSERT INTO nodes_fts(rowid, node_id, title, plain_text) ${FTS_ROW} WHERE n.deleted_at IS NULL;`;

/** Child tables first, so a full wipe never trips a foreign key. */
export const WIPE_ALL = `DELETE FROM gimmick_blueprints; DELETE FROM gimmick_packs;
DELETE FROM gimmick_blueprints_fts;
DELETE FROM growth_logs; DELETE FROM node_links; DELETE FROM node_bodies; DELETE FROM nodes;
DELETE FROM media_assets; DELETE FROM settings; DELETE FROM nodes_fts;`;
