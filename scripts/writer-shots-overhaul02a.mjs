// OVERHAUL-02A shot pack (pack root; chained from writer-shots.mjs), each in a fresh context:
//   01 Settings root's 4 calm hubs beside the Web Publishing & API sub-screen,
//   02 Book Compiler: symmetrical 2x4 export grid + Copy Royal Road HTML / Print card below,
//   03 Recent strip + Trash showing Character / Location / Lore kind labels and Feather icons,
//   04 Türkçe Library beside Español Book Compiler, both with 0 px horizontal overflow.
import { skipOnboarding } from './lib/writer-fixtures.mjs';

const ENTITIES = [
  { id: 'ov02a-mara', title: 'Mara Quell', kind: 'character', label: 'Character' },
  { id: 'ov02a-quay', title: 'Sodium Quay', kind: 'location', label: 'Location' },
  { id: 'ov02a-tide', title: 'The Chrome Tide', kind: 'lore', label: 'Lore' },
];
const TILES = ['docx', 'epub', 'pdf', 'md', 'html', 'royalroad', 'txt', 'knbook'];

async function freshPage(browser, errors) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
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

async function composite(browser, panels, path) {
  if (!path) return;
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

const repoReady = (page) =>
  page.waitForFunction(() => '__knWriterRepo' in globalThis, null, { timeout: 20000 });
const overflowX = (page) =>
  page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
const settle = (page, ms = 400) => page.waitForTimeout(ms);

/** Seeds three root-level Story Bible entities (character / location / lore) into the v2 schema. */
const seedEntities = (page) =>
  page.evaluate(async (list) => {
    const now = new Date().toISOString();
    await globalThis.__knWriterDb.putNodes(
      list.map((e, i) => ({
        node: {
          id: e.id,
          kind: e.kind,
          parentId: null,
          bookId: null,
          title: e.title,
          subtitle: null,
          position: i,
          workspaceMode: null,
          coverAssetId: null,
          locked: false,
          deletedAt: null,
          wordCount: 2,
          createdAt: now,
          updatedAt: now,
          metaJson: null,
        },
        body: { nodeId: e.id, blocksJson: '[]', plainText: '', updatedAt: now },
        links: [],
      })),
    );
  }, ENTITIES);

async function settingsHubs(browser, { WRITER, path, ok, fail, errors }) {
  const a = await freshPage(browser, errors);
  await a.goto(`${WRITER}settings`);
  await a.getByTestId('settings-root').waitFor({ timeout: 20000 });
  const hubs = ['card-appearance', 'card-data', 'card-web', 'card-privacy'];
  const present = await Promise.all(hubs.map((id) => a.getByTestId(id).count()));
  const devFields = await a.getByTestId('publish-api-url').count();
  if (present.every((n) => n === 1) && devFields === 0)
    ok('Settings root: 4 hubs, no Publish API / token fields on the root');
  else fail(`Settings hubs ${JSON.stringify(present)}; dev fields on root: ${devFields}`);
  const root = await a.screenshot();
  await a.getByTestId('open-publishing').click();
  await a.getByTestId('publish-api-url').waitFor({ timeout: 15000 });
  const clip = await a
    .getByTestId('card-publishing')
    .evaluate((el) => [
      getComputedStyle(el).overflow,
      parseFloat(getComputedStyle(el).borderRadius),
    ]);
  const url = a.url();
  if (url.endsWith('/settings-publishing') && clip[0] === 'hidden' && clip[1] > 0)
    ok('1 tap into Web Publishing & API; its card is rounded and clips its rows');
  else fail(`publishing sub-screen: url=${url} clip=${JSON.stringify(clip)}`);
  await a.getByTestId('settings-preview-mode').waitFor();
  await settle(a);
  await composite(browser, [root, await a.screenshot()], path('01-settings-4-hubs'));
  await a.goBack();
  await a.getByTestId('open-backup').click();
  await a.getByTestId('backup-now').waitFor({ timeout: 15000 });
  ok('1 tap into Backups & External Folder (backup testIDs intact)');
  await a.context().close();
}

async function compilerGrid(browser, { WRITER, path, ok, fail, errors }) {
  const b = await freshPage(browser, errors);
  await b.goto(`${WRITER}novel/vertical-slice/compile`);
  await b.getByTestId('export-knbook').waitFor({ timeout: 20000 });
  const boxes = [];
  for (const f of TILES) boxes.push(await b.getByTestId(`export-${f}`).boundingBox());
  const xs = [...new Set(boxes.map((r) => Math.round(r.x)))];
  const ys = [...new Set(boxes.map((r) => Math.round(r.y)))];
  const widths = new Set(boxes.map((r) => Math.round(r.width)));
  if (xs.length === 2 && ys.length === 4 && widths.size === 1)
    ok('Book Compiler: 8 export tiles in a symmetrical 2x4 grid');
  else fail(`export grid columns=${xs.length} rows=${ys.length} widths=${[...widths]}`);
  const tile9 = await b.locator('[data-testid="export-print"]').evaluate((el) => {
    const card = el.closest('[data-testid="card-export-secondary"]');
    return Boolean(card?.querySelector('[data-testid="export-royalroad-copy"]'));
  });
  if (tile9) ok('Copy Royal Road HTML + Print grouped in a card below the grid (no 9th tile)');
  else fail('Print / Copy Royal Road HTML are not grouped in card-export-secondary');
  const hint = b.getByTestId('export-royalroad').getByText('Ready to paste');
  const cut = (await hint.count())
    ? await hint.first().evaluate((el) => el.scrollWidth > el.clientWidth + 1)
    : true;
  if (!cut) ok('Royal Road subtitle "Ready to paste" renders untruncated at 390 dp');
  else fail('Royal Road subtitle missing or truncated');
  await b.getByTestId('export-docx').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await b.evaluate(() => {
    let s = document.querySelector('[data-testid="export-docx"]')?.parentElement;
    while (s && s.scrollHeight <= s.clientHeight) s = s.parentElement;
    s?.scrollBy(0, -90);
  });
  await settle(b);
  if (path) await b.screenshot({ path: path('02-compiler-2x4-grid') });
  await b.context().close();
}

async function entityLabels(browser, { WRITER, path, ok, fail, errors }) {
  const c = await freshPage(browser, errors);
  await c.goto(WRITER);
  await repoReady(c);
  await seedEntities(c);
  await c.goto(WRITER);
  await c.getByTestId(`recent-tile-${ENTITIES[0].id}`).waitFor({ timeout: 20000 });
  const recent = [];
  for (const e of ENTITIES) recent.push(await c.getByTestId(`recent-tile-${e.id}`).innerText());
  if (ENTITIES.every((e, i) => recent[i].includes(e.label) && !/\bNote\b/.test(recent[i])))
    ok('Recent strip labels Character / Location / Lore (never "Note")');
  else fail(`Recent tile subtitles: ${JSON.stringify(recent)}`);
  await c.getByTestId('recent-strip').scrollIntoViewIfNeeded();
  await settle(c);
  const strip = await c.screenshot();
  await c.goto(`${WRITER}folders`);
  for (const e of ENTITIES) {
    await c.getByTestId(`item-menu-${e.id}`).click();
    await c.getByTestId(`menu-delete-${e.id}`).click();
    await c.getByTestId('dialog-confirm').click();
    await c.getByTestId(`item-menu-${e.id}`).waitFor({ state: 'detached', timeout: 10000 });
  }
  await c.goto(`${WRITER}trash`);
  await c.getByTestId(`trash-row-${ENTITIES[2].id}`).waitFor({ timeout: 15000 });
  const rows = [];
  for (const e of ENTITIES) rows.push(await c.getByTestId(`trash-row-${e.id}`).innerText());
  if (ENTITIES.every((e, i) => rows[i].includes(e.label)))
    ok('Trash badges read Character / Location / Lore');
  else fail(`Trash rows: ${JSON.stringify(rows)}`);
  await settle(c);
  await composite(browser, [strip, await c.screenshot()], path('03-recent-trash-entity-labels'));
  await c.context().close();
}

async function localeShots(browser, { WRITER, path, ok, fail, errors }) {
  const d = await freshPage(browser, errors);
  await d.goto(`${WRITER}settings`);
  await d.getByTestId('settings-language-tr').click();
  await settle(d);
  await d.goto(WRITER);
  await d.getByTestId('novel-card-vertical-slice').waitFor({ timeout: 20000 });
  await settle(d);
  const card = await d.getByTestId('novel-card-vertical-slice').innerText();
  const trOver = await overflowX(d);
  const library = await d.screenshot();
  if (/bölüm/.test(card) && trOver <= 0)
    ok(`Türkçe Library: "${card.split('\n')[1] ?? ''}", 0 px overflow`);
  else fail(`Türkçe Library card="${card}" overflow=${trOver}px`);
  await d.goto(`${WRITER}settings`);
  await d.getByTestId('settings-language-es').click();
  await settle(d);
  const settingsOver = await overflowX(d);
  await d.goto(`${WRITER}novel/vertical-slice/compile`);
  await d.getByTestId('export-knbook').waitFor({ timeout: 20000 });
  await settle(d);
  const rr = await d.getByTestId('export-royalroad').innerText();
  const esOver = await overflowX(d);
  if (esOver <= 0 && settingsOver <= 0 && !rr.includes('Ready'))
    ok(
      `Español Settings + Book Compiler: translated, 0 px overflow (Royal Road: "${rr.replace('\n', ' · ')}")`,
    );
  else fail(`Español overflow settings=${settingsOver}px compiler=${esOver}px rr="${rr}"`);
  await composite(browser, [library, await d.screenshot()], path('04-turkish-and-spanish-i18n'));
  await d.goto(`${WRITER}settings`);
  await d.getByTestId('settings-language-system').click();
  await settle(d, 300);
  await d.context().close();
}

export async function ov02aPass(browser, { WRITER, packAt, ok, fail }) {
  const errors = [];
  const path = (name) => packAt && `${packAt}/${name}.png`;
  const ctx = { WRITER, path, ok, fail, errors };
  await settingsHubs(browser, ctx);
  await compilerGrid(browser, ctx);
  await entityLabels(browser, ctx);
  await localeShots(browser, ctx);
  if (errors.length) fail(`OVERHAUL-02A pack console errors:\n  ${errors.join('\n  ')}`);
  else ok('OVERHAUL-02A pack: zero console/page errors');
}
