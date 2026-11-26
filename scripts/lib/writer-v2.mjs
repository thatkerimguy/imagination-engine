// OVERHAUL-01 QA plumbing for the v2 relational writer on Expo Web. The web driver persists one
// localStorage key per table (`kn-writer-v2:<table>`); content is seeded through the live engine
// (`__knWriterDb` / `__knWriterRepo`, exposed only when `kn-writer-v2:qa` is set) so foreign
// keys, cascades and the FTS5-equivalent index stay consistent.
export const V2 = 'kn-writer-v2:';

/** Opt the page/context into the QA hooks (before the app boots). */
export const enableQa = (target) =>
  target.addInitScript(() => localStorage.setItem('kn-writer-v2:qa', '1'));

/** Pre-boot seed of one settings-table row (settings have no foreign keys). */
export const initSetting = (target, key, data) =>
  target.addInitScript(
    ([k, d]) => {
      const table = 'kn-writer-v2:settings';
      const rows = JSON.parse(localStorage.getItem(table) ?? '[]');
      if (rows.some((r) => r.key === k)) return;
      const updatedAt = new Date(1).toISOString();
      rows.push({ key: k, valueJson: JSON.stringify({ data: d, updatedAt: 1 }), updatedAt });
      localStorage.setItem(table, JSON.stringify(rows));
    },
    [key, data],
  );

/** The persisted `{ data, updatedAt }` JSON of a settings row, or null. */
export const readSetting = (page, key) =>
  page.evaluate((k) => {
    const rows = JSON.parse(localStorage.getItem('kn-writer-v2:settings') ?? '[]');
    return rows.find((r) => r.key === k)?.valueJson ?? null;
  }, key);

export const waitForRepo = (page) =>
  page.waitForFunction(() => Boolean(globalThis.__knWriterRepo), null, { timeout: 30000 });

/**
 * Applies v1-shaped QA fixtures (`[key, '{"data":…,"updatedAt":…}']`) to the v2 tables:
 * `folder/<id>` + `doc/<id>` → folder / note nodes (+ bodies), `growth/<kind>:<id>` → growth rows,
 * everything else (meta/, versions/, setting/) → settings rows. Rows whose parent does not exist
 * (or whose JSON is corrupt) cannot exist under foreign keys and are skipped — except corrupt
 * settings, which are stored as-is so Document Doctor can find them.
 */
export async function seedKv(page, entries) {
  await waitForRepo(page);
  return page.evaluate(async (list) => {
    const db = globalThis.__knWriterDb;
    const repo = globalThis.__knWriterRepo;
    const iso = (ms) => new Date(ms).toISOString();
    const parse = (v) => {
      try {
        return JSON.parse(v).data;
      } catch {
        return undefined;
      }
    };
    const node = (r, kind) => ({
      id: r.id,
      kind,
      parentId: r.parentFolderId ?? null,
      bookId: null,
      title: r.title,
      subtitle: null,
      position: r.createdAt ?? 0,
      workspaceMode: null,
      coverAssetId: null,
      locked: false,
      deletedAt: null,
      wordCount: 0,
      createdAt: iso(r.createdAt ?? 0),
      updatedAt: iso(r.updatedAt ?? 0),
      metaJson: null,
    });
    const folders = [];
    const docs = [];
    let skipped = 0;
    for (const [key, raw] of list) {
      const data = parse(raw);
      if (key.startsWith('folder/') && data) folders.push(data);
      else if (key.startsWith('doc/') && data) docs.push(data);
      else if (key.startsWith('growth/')) {
        const id = key.slice(key.indexOf(':') + 1);
        if (!data?.points || !(await db.getNode(id))) skipped++;
        else
          await db.putGrowthLogs(
            data.points.map((p, i) => ({
              id: `qa-${id}-${i}`,
              nodeId: id,
              bookId: null,
              dateKey: p.dayKey,
              wordCount: p.words,
              chars: p.chars,
              sentences: p.sentences,
              paragraphs: p.paragraphs,
              isBaseline: false,
              recordedAt: iso(p.ts),
            })),
          );
      } else await db.setSetting(key, raw);
    }
    const known = async (id) => !id || (await db.getNode(id)) !== null;
    for (let pending = folders; pending.length;) {
      const ready = [];
      for (const f of pending) if (await known(f.parentFolderId)) ready.push(f);
      if (!ready.length) {
        skipped += pending.length;
        break;
      }
      await db.putNodes(ready.map((f) => ({ node: node(f, 'folder') })));
      pending = pending.filter((f) => !ready.includes(f));
    }
    for (const d of docs) {
      if (!(await known(d.parentFolderId))) {
        skipped++;
        continue;
      }
      const plainText = d.blocks.map((b) => b.text ?? '').join('\n');
      const body = {
        nodeId: d.id,
        blocksJson: JSON.stringify(d.blocks),
        plainText,
        updatedAt: iso(d.updatedAt),
      };
      await db.putNodes([{ node: node(d, 'note'), body }]);
    }
    // `locked` lives on the node in v2 (item meta keeps the rest).
    for (const [key, raw] of list) {
      const n =
        key.startsWith('meta/item/') && parse(raw)?.locked ? await db.getNode(key.slice(10)) : null;
      if (n) await db.putNodes([{ node: { ...n, locked: true } }]);
    }
    repo.notifyChanged();
    return { skipped };
  }, entries);
}
