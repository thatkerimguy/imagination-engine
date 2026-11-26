// Expo Web (QA / Playwright): the in-memory relational engine, persisted table-by-table to
// localStorage after every committed write. No WASM, no native module, no console noise; falls
// back to pure memory when storage is blocked (private mode, quota).
import { MemoryDatabase } from './memory-driver.ts';
import { emptyTables, type DatabasePort, type DatabaseTables } from './port.ts';

const NS = 'kn-writer-v2:';

function storage(): Storage | null {
  try {
    const ls = globalThis.localStorage;
    ls.setItem(`${NS}probe`, '1');
    ls.removeItem(`${NS}probe`);
    return ls;
  } catch {
    return null;
  }
}

function readTables(ls: Storage): DatabaseTables {
  const out = emptyTables();
  for (const key of Object.keys(out) as (keyof DatabaseTables)[]) {
    try {
      const rows: unknown = JSON.parse(ls.getItem(NS + key) ?? '[]');
      if (Array.isArray(rows)) (out[key] as unknown[]) = rows;
    } catch {
      // A corrupt table starts empty; Document Doctor reports what is missing.
    }
  }
  return out;
}

let opening: Promise<DatabasePort> | null = null;

export function openDatabase(): Promise<DatabasePort> {
  opening ??= Promise.resolve().then(() => {
    const ls = storage();
    if (!ls) return new MemoryDatabase('web');
    let db: MemoryDatabase;
    try {
      db = new MemoryDatabase('web', readTables(ls));
    } catch {
      db = new MemoryDatabase('web');
    }
    // Playwright QA hook (opt-in via `kn-writer-v2:qa`): seed rows through the live engine so
    // foreign keys, cascades and the FTS index stay consistent. Never set in normal use.
    if (ls.getItem(`${NS}qa`) === '1') Object.assign(globalThis, { __knWriterDb: db });
    db.onCommit = (touched) => {
      void db.exportTables().then((all) => {
        try {
          for (const key of touched) ls.setItem(NS + key, JSON.stringify(all[key]));
        } catch (err) {
          console.warn('[writer] web storage write failed', err);
        }
      });
    };
    return db;
  });
  return opening;
}
