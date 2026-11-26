// OVERHAUL-01 shot pack (pack root; run last by writer-shots.mjs), each in its own fresh context:
//   01 Library seeded from relational v2 `nodes` | instant FTS search returning chapter + note,
//   02 Document Doctor v2 "All clear" after a Trash â†’ Empty trash cycle,
//   03 compact landscape editor with the soft keyboard up: MetricsRibbon auto-collapsed.
import { skipOnboarding } from './lib/writer-fixtures.mjs';
import { seedKv } from './lib/writer-v2.mjs';
import { ov02Pass } from './writer-shots-overhaul02.mjs';

async function composite(browser, panels, path) {
  const tab = await browser.newPage({ deviceScaleFactor: 2 });
  await tab.setViewportSize({ width: 390 * panels.length + 12 * (panels.length + 1), height: 868 });
  const imgs = panels.map((b) => `data:image/png;base64,${b.toString('base64')}`);
  await tab.setContent(
    `<body style="margin:0;padding:12px;display:flex;gap:12px;background:#0b0c10">${imgs
      .map((src) => `<img src="${src}" style="width:390px;height:844px">`)
      .join('')}</body>`,
  );
  await tab.waitForTimeout(200);
  await tab.screenshot({ path });
  await tab.close();
}

async function freshPage(browser, errors, viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    hasTouch: true,
    colorScheme: 'dark',
  });
  await skipOnboarding(ctx);
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  return page;
}

const NOTE = {
  id: 'ov01-pilot',
  parentFolderId: null,
  title: 'Harbour pilot',
  blocks: [
    {
      id: '01M7WD7TGC0000000000000001',
      kind: 'prose',
      text: 'The lantern pilot knows every buoy.',
    },
  ],
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

export async function ov01Pass(browser, { WRITER, packAt, ok, fail }) {
  const errors = [];
  const path = (name) => `${packAt}/${name}.png`;

  // 01 â€” Library from v2 nodes + FTS search.
  const a = await freshPage(browser, errors);
  const tid = (id) => a.getByTestId(id);
  await a.goto(WRITER);
  await tid('novel-card-vertical-slice').waitFor({ timeout: 20000 });
  await seedKv(a, [[`doc/${NOTE.id}`, JSON.stringify({ data: NOTE, updatedAt: 1 })]]);
  const rows = await a.evaluate(async () => {
    const db = globalThis.__knWriterDb;
    return {
      driver: db.driver,
      version: db.schemaVersion,
      books: (await db.listNodes({ kinds: ['book'] })).length,
      hits: (await db.search('lant')).map((h) => h.nodeId),
    };
  });
  if (rows.driver === 'web' && rows.version === 2 && rows.books === 1)
    ok('Library seeded from v2 relational nodes (user_version 2)');
  else fail(`unexpected v2 store: ${JSON.stringify(rows)}`);
  if (rows.hits.includes('ch01') && rows.hits.includes(NOTE.id))
    ok('FTS prefix "lant" matches chapter ch01 and the note');
  else fail(`FTS hits: ${rows.hits}`);
  await a.waitForTimeout(300);
  const library = await a.screenshot();
  await a.goto(`${WRITER}search`);
  await tid('search-field').fill('lant');
  await tid('search-result-1').waitFor({ timeout: 10000 });
  const kinds = await a.locator('[data-testid^="search-result-"]').count();
  ok(`instant FTS search lists ${kinds} results for "lant"`);
  await a.keyboard.press('Escape').catch(() => {});
  await a.waitForTimeout(300);
  if (packAt)
    await composite(browser, [library, await a.screenshot()], path('01-v2-library-and-fts-search'));

  // 02 â€” Trash â†’ Empty trash â†’ Document Doctor v2 all clear.
  await a.evaluate(async (id) => {
    const n = await globalThis.__knWriterDb.getNode(id);
    await globalThis.__knWriterDb.putNodes([
      { node: { ...n, deletedAt: new Date().toISOString() } },
    ]);
  }, NOTE.id);
  await a.goto(`${WRITER}trash`);
  await tid('trash-empty').click();
  await tid('dialog-confirm').click();
  await a.waitForFunction(async (id) => !(await globalThis.__knWriterDb.getNode(id)), NOTE.id);
  const integrity = await a.evaluate(() => globalThis.__knWriterDb.integrity());
  if (
    integrity.ftsRows === integrity.activeNodes &&
    integrity.orphanBodies + integrity.orphanLinks + integrity.orphanGrowth === 0
  )
    ok(
      `Empty trash: cascade left 0 orphans; nodes_fts ${integrity.ftsRows} = active ${integrity.activeNodes}`,
    );
  else fail(`integrity after empty trash: ${JSON.stringify(integrity)}`);
  await a.goto(`${WRITER}doctor`);
  await a.getByText('All clear').waitFor({ timeout: 15000 });
  ok('Document Doctor v2 reports "All clear"');
  await a.waitForTimeout(300);
  if (packAt) await a.screenshot({ path: path('02-doctor-v2-all-clear') });
  await a.context().close();

  // 03 â€” Compact landscape + soft keyboard: the ribbon auto-collapses.
  const b = await freshPage(browser, errors, { width: 844, height: 390 });
  await b.goto(`${WRITER}novel/vertical-slice/chapter/s01/ch01`);
  await b.getByTestId('metrics-ribbon').waitFor({ timeout: 20000 });
  const toggle = b.getByTestId('metrics-collapse');
  if ((await toggle.getAttribute('aria-label')) === 'Hide metrics')
    ok('landscape, keyboard down: ribbon expanded');
  else fail('ribbon collapsed before typing');
  // OVERHAUL-02: prose is a live run surface, so one tap focuses it directly.
  await b.locator('textarea[data-testid^="prose-text-"]').first().click();
  await b.locator('textarea').first().waitFor({ timeout: 10000 });
  await b.locator('textarea').first().focus();
  await b.waitForFunction(
    () =>
      document.querySelector('[data-testid="metrics-collapse"]')?.getAttribute('aria-label') ===
      'Show metrics',
    null,
    { timeout: 5000 },
  );
  ok('compact landscape (< 500 dp) + keyboard: MetricsRibbon auto-collapses');
  await b.waitForTimeout(300);
  if (packAt) await b.screenshot({ path: path('03-landscape-metrics-autocollapse') });
  await b.locator('textarea').first().blur();
  await b.waitForFunction(
    () =>
      document.querySelector('[data-testid="metrics-collapse"]')?.getAttribute('aria-label') ===
      'Hide metrics',
    null,
    { timeout: 5000 },
  );
  ok("keyboard hidden: the Author's expanded ribbon comes back");
  await b.context().close();

  if (errors.length) fail(`OVERHAUL-01 pack console errors:\n  ${errors.join('\n  ')}`);
  else ok('OVERHAUL-01 pack: zero console/page errors');
  await ov02Pass(browser, { WRITER, packAt, ok, fail });
}
