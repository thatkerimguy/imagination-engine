// Publish end-to-end smoke: local publish API + Expo Web writer (390x844) + a reader build that reads
// books from that API. Needs `pnpm writer:export` (apps/writer/dist-web) and Playwright + Chromium.
// Usage: node scripts/smoke-publish.mjs [--shots <dir>]
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { freePort, serveStatic, startApi, stopAll, win } from './smoke-publish-helpers.mjs';
import { MOD_TOKEN, calmModeDimming, passTosGate, reportAbuse } from './smoke-publish-ugc.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = resolve(import.meta.dirname, '..');
const WRITER_DIST = join(ROOT, 'apps/writer/dist-web');
const shotsAt = process.argv.includes('--shots')
  ? process.argv[process.argv.indexOf('--shots') + 1]
  : null;
if (shotsAt) mkdirSync(shotsAt, { recursive: true });
const ugcAt = process.argv.includes('--ugc-shots')
  ? process.argv[process.argv.indexOf('--ugc-shots') + 1]
  : shotsAt;
const TOKEN = 'smoke-token';
const NOVEL = 'vertical-slice';
const errors = [];
let failed = false;
const fail = (msg) => ((failed = true), console.error(`❌ ${msg}`));
const ok = (msg) => console.log(`✅ ${msg}`);
const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

if (!statSync(WRITER_DIST, { throwIfNoEntry: false })?.isDirectory()) {
  console.error('apps/writer/dist-web is missing. Run `pnpm writer:export` first.');
  process.exit(2);
}

const getJson = async (url) => {
  const r = await fetch(url);
  return { status: r.status, body: r.status === 200 ? await r.json() : null };
};

const readerTmp = mkdtempSync(join(tmpdir(), 'kn-reader-publish-'));
const servers = [];
try {
  const apiPort = await freePort(8787);
  const API = `http://127.0.0.1:${apiPort}`;
  await startApi(apiPort, TOKEN, { MODERATION_TOKEN: MOD_TOKEN });
  ok(`publish API up on ${API}`);

  const build = spawnSync(
    'pnpm',
    ['--filter', '@kn/reader', 'exec', 'vite', 'build', '--outDir', readerTmp, '--emptyOutDir'],
    {
      cwd: ROOT,
      env: { ...process.env, VITE_NOVELS_BASE_URL: `${API}/novels/` },
      stdio: 'ignore',
      shell: win,
    },
  );
  if (build.status !== 0) throw new Error('reader build failed');
  const readerPort = await freePort(0);
  const writerPort = await freePort(0);
  servers.push(
    await serveStatic(readerTmp, readerPort),
    await serveStatic(WRITER_DIST, writerPort),
  );
  const READER = `http://127.0.0.1:${readerPort}`;
  const WRITER = `http://127.0.0.1:${writerPort}`;

  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: shotsAt ? 2 : 1,
    hasTouch: true,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const watch = (page, tag) => {
    page.on('console', (m) => m.type() === 'error' && errors.push(`${tag}: ${m.text()}`));
    page.on('pageerror', (e) => errors.push(`${tag}: ${e}`));
  };
  const shot = (page, name) => shotsAt && page.screenshot({ path: join(shotsAt, name) });
  const ugcShot = (page, name) => ugcAt && page.screenshot({ path: join(ugcAt, name) });
  const writer = await context.newPage();
  watch(writer, 'writer');
  const tid = (id) => writer.getByTestId(id);

  // First launch seeds the demo; then add an unlisted and a draft chapter beside Snake Eyes.
  await writer.goto(WRITER);
  await writer.waitForFunction(() => localStorage.getItem('kn-writer:novel/vertical-slice'), null, {
    timeout: 30000,
  });
  await writer.evaluate(() => {
    const NS = 'kn-writer:';
    const put = (key, data) =>
      localStorage.setItem(NS + key, JSON.stringify({ data, updatedAt: Date.now() }));
    const chapter = (id, title, status, blockId, text) => ({
      id,
      seasonId: 's01',
      title,
      status,
      blocks: [{ id: blockId, kind: 'prose', text }],
    });
    const base = 'chapter/vertical-slice/s01/';
    put(
      base + 'ch02',
      chapter(
        'ch02',
        'Beta Read',
        'unlisted',
        '01M7WD7TG7A1B2C3D4E5F6G7H8',
        'For beta readers only.',
      ),
    );
    put(
      base + 'ch03',
      chapter('ch03', 'Work in Progress', 'draft', '01M7WD7TG9J1K2M3N4P5Q6R7S8', 'Not ready yet.'),
    );
    const key = NS + 'season/vertical-slice/s01';
    const season = JSON.parse(localStorage.getItem(key)).data;
    season.chapters = ['ch01', 'ch02', 'ch03'];
    put('season/vertical-slice/s01', season);
  });

  // Settings: configure publishing and test the connection.
  await writer.goto(`${WRITER}/settings`);
  await tid('publish-api-url').fill(API);
  await tid('publish-token').fill(TOKEN);
  await tid('publish-reader-url').fill(READER);
  await tid('publish-reader-url').blur();
  await tid('publish-test').click();
  await writer.getByText('Connected', { exact: true }).waitFor({ timeout: 15000 });
  check(
    (await tid('publish-test-status').innerText()) === 'Connected',
    'Test connection shows Connected',
  );
  check((await tid('publish-token').getAttribute('type')) === 'password', 'Author token is masked');
  await tid('card-publishing').scrollIntoViewIfNeeded();
  await shot(writer, '01-settings-publishing-card.png');

  // Outline -> Publish sheet.
  await writer.goto(`${WRITER}/novel/${NOVEL}`);
  await tid('outline-publish').click();
  await tid('publish-sheet').waitFor();
  await writer.waitForFunction(
    () => document.querySelector('[data-testid="publish-count-published"]')?.textContent === '1',
    null,
    { timeout: 15000 },
  );
  const counts = await Promise.all(
    ['published', 'unlisted', 'drafts'].map((n) => tid(`publish-count-${n}`).innerText()),
  );
  check(counts.join('/') === '1/1/1', `ledger counts 1/1/1 (got ${counts.join('/')})`);
  // Let the sheet's slide-in finish: wait until the ledger sits still inside the viewport.
  await writer.waitForFunction(
    () => {
      const el = document.querySelector('[data-testid="publish-ledger"]');
      const y = el?.getBoundingClientRect().top ?? Infinity;
      const settled = y < innerHeight && y === window.__knLastY;
      window.__knLastY = y;
      return settled;
    },
    undefined,
    { polling: 150, timeout: 5000 },
  );
  await shot(writer, '02-publish-sheet-preflight.png');
  await passTosGate(writer, { tid, check, shot: ugcShot, API });
  await tid('publish-now').click();
  await tid('publish-toast').waitFor({ timeout: 20000 });
  check(
    (await tid('publish-toast').innerText()) === 'Published Chrome Tide',
    'toast: Published Chrome Tide',
  );
  await tid('publish-copy-public').click();
  check(
    (await writer.evaluate(() => navigator.clipboard.readText())) === `${READER}/?novel=${NOVEL}`,
    'public link copied to clipboard',
  );
  await tid('publish-copy-unlisted-ch02').waitFor();
  await tid('publish-unpublish').scrollIntoViewIfNeeded();
  await shot(writer, '03-publish-sheet-live-links.png');

  // What the API now serves.
  const index = await getJson(`${API}/novels/index.json`);
  check(JSON.stringify(index.body).includes(NOVEL), 'index.json lists vertical-slice');
  const chap = (id) => `${API}/novels/${NOVEL}/seasons/s01/${id}.json`;
  const [c1, c2, c3, season] = await Promise.all([
    getJson(chap('ch01')),
    getJson(chap('ch02')),
    getJson(chap('ch03')),
    getJson(`${API}/novels/${NOVEL}/seasons/s01/season.json`),
  ]);
  check(c1.status === 200, 'published ch01 served');
  check(c3.status === 404, 'draft ch03 not served');
  check(
    c2.status === 200 && !season.body.chapters.includes('ch02'),
    'unlisted ch02 served but not listed',
  );
  check(
    ![c1, c2].some((c) => JSON.stringify(c.body).includes('{{comment')),
    'no author comments leaked',
  );

  // Reader reads from the API.
  const reader = await context.newPage();
  watch(reader, 'reader');
  const novelRequests = [];
  reader.on('request', (r) => r.url().includes('/novels/') && novelRequests.push(r.url()));
  await reader.goto(`${READER}/?novel=${NOVEL}&season=s01&chapter=ch01`);
  await reader
    .locator('#main')
    .getByRole('heading', { name: 'Snake Eyes' })
    .waitFor({ timeout: 20000 });
  ok('reader renders Snake Eyes');
  check(
    novelRequests.length > 0 && novelRequests.every((u) => u.startsWith(`${API}/novels/`)),
    'reader fetched books from the publish API',
  );
  const start = reader.getByRole('button', { name: /Silent/ });
  if (await start.isVisible().catch(() => false)) await start.click();
  await reader.waitForTimeout(400);
  await shot(reader, '04-reader-live-from-publish-api.png');
  await reportAbuse(reader, { check, shot: ugcShot, API });
  await calmModeDimming(reader, { check });

  // Unpublish.
  await tid('publish-unpublish').click();
  await writer.getByText('Unpublish', { exact: true }).last().click();
  await tid('publish-note').waitFor({ timeout: 15000 });
  check((await getJson(chap('ch01'))).status === 404, 'unpublish removes the book');

  check(
    errors.length === 0,
    `zero console/page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`,
  );
  await browser.close();
} catch (err) {
  fail(String(err?.stack ?? err));
} finally {
  for (const s of servers) s.close();
  stopAll();
  rmSync(readerTmp, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
