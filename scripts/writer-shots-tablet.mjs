// DIRECTIVE-03 large-screen + Calm Mode pack, run after writer-shots.mjs (which spawns it):
// the Expo Web export at 1280×800 (Navigation Rail, 3-column Library grid, Expanded split-pane
// Reference drawer, web hardware-keyboard shortcuts, draft survival across a phone/tablet
// resize) and the built Reader's Aa drawer with Calm Mode on. Needs `pnpm build` (reader dist)
// and `pnpm writer:export`. Usage: node scripts/writer-shots-tablet.mjs [--shots <dir>]
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { serveSpa } from './lib/spa-server.mjs';
import { skipOnboarding } from './lib/writer-fixtures.mjs';
import { startPreviewServer } from './smoke-server.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const shotsAt = process.argv.includes('--shots')
  ? process.argv[process.argv.indexOf('--shots') + 1]
  : null;
if (shotsAt) mkdirSync(shotsAt, { recursive: true });
// DIRECTIVE-04 named shot (pack root); the D-03 shots above go wherever --shots points.
const dir04At = process.argv.includes('--dir04')
  ? process.argv[process.argv.indexOf('--dir04') + 1]
  : shotsAt;
const WRITER = 'http://127.0.0.1:8098/';
const READER = 'http://127.0.0.1:4173/';
const DIST = resolve(import.meta.dirname, '../apps/writer/dist-web');
const TABLET = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };
const MARK = 'Tablet draft survives the fold.';

const errors = [];
const fail = (msg) => {
  console.error(`❌ ${msg}`);
  process.exitCode = 1;
};
const ok = (msg) => console.log(`✅ ${msg}`);
const writer = serveSpa(DIST, 8098);
const stopReader = await startPreviewServer(READER);

const watch = (page) => {
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept());
};

try {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({
    viewport: TABLET,
    deviceScaleFactor: 1,
    colorScheme: 'dark',
  });
  await skipOnboarding(page);
  watch(page);
  await page.route('**/*', (route) => {
    const { hostname } = new URL(route.request().url());
    return hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  const tid = (id) => page.getByTestId(id);
  const shot = (name) => shotsAt && page.screenshot({ path: `${shotsAt}/${name}.png` });

  // 01 Library: left rail, no bottom tab bar, three-column grid.
  await page.goto(WRITER);
  await tid('novel-card-vertical-slice').waitFor({ timeout: 20000 });
  for (const title of ['Low Tide Ledger', 'Glass Orchard']) {
    await page.goto(`${WRITER}new-novel`);
    await tid('novel-title').fill(title);
    await tid('novel-author').fill('QA Author');
    await tid('create-novel').click();
    await page.waitForURL((u) => !u.pathname.includes('new-novel'), { timeout: 10000 });
  }
  await page.goto(WRITER);
  await tid('nav-rail').waitFor({ timeout: 20000 });
  if (await tid('tab-bar').count()) fail('bottom tab bar still shows beside the rail');
  else ok('>= 600dp: FolioNavRail replaces the bottom tab bar');
  await tid('novel-card-vertical-slice').waitFor({ timeout: 20000 });
  const tops = await page
    .locator('[data-testid^="novel-card-"]')
    .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  if (tops.length >= 3 && new Set(tops).size === 1)
    ok(`Library grid: ${tops.length} covers in one row`);
  else fail(`Library grid is not 3 columns: card tops ${JSON.stringify(tops)}`);
  await page.waitForTimeout(300);
  await shot('01-tablet-library-rail-grid');

  // 02 Editor: centred 720dp column + Reference pane (Outline), web shortcuts, draft survival.
  await page.goto(`${WRITER}novel/vertical-slice/chapter/s01/ch01`);
  await tid('reference-toggle').waitFor({ timeout: 20000 });
  await tid('reference-toggle').click();
  await tid('reference-pane').waitFor();
  ok('>= 840dp: Reference pane opens beside the editor');
  const pane = tid('reference-pane');
  await pane
    .getByText(/^3D Dice Throw/)
    .first()
    .waitFor({ timeout: 5000 });
  const raw = await pane.getByText(/^(bl-dice-3d|gits-cyberbrain-chat|core-ambient-bed)$/).count();
  if (raw === 0) ok('Outline shows human-readable module titles (no raw ids)');
  else fail(`Outline still shows ${raw} raw module id(s)`);
  if (dir04At) await page.screenshot({ path: `${dir04At}/03-tablet-outline-human-labels.png` });
  const col = await tid('chapter-stream').evaluate(
    (el) => el.firstElementChild.getBoundingClientRect().width,
  );
  if (col <= 720.5) ok(`prose column constrained to ${Math.round(col)}dp`);
  else fail(`prose column is ${Math.round(col)}dp wide (> 720)`);
  const prose = page.locator('[data-testid^="prose-text-"]').first();
  await prose.click();
  const area = page.locator('textarea[data-testid^="prose-text-"]').first();
  await area.press('Control+End');
  await area.pressSequentially(` ${MARK}`);
  await page.keyboard.press('Control+/');
  await tid('shortcuts-sheet').waitFor({ timeout: 5000 });
  await page.keyboard.press('Escape');
  await tid('shortcuts-sheet').waitFor({ state: 'detached', timeout: 5000 });
  ok('Ctrl+/ opens the shortcuts sheet, Escape closes it');
  await page.keyboard.press('Control+f');
  await tid('find-replace-bar').waitFor({ timeout: 5000 });
  await page.keyboard.press('Control+f');
  await tid('find-replace-bar').waitFor({ state: 'detached', timeout: 5000 });
  ok('Ctrl+F toggles Find & Replace');
  await page.setViewportSize(PHONE);
  await page.waitForTimeout(400);
  if (await tid('reference-pane').count()) fail('Reference pane still open on a phone width');
  await page.setViewportSize(TABLET);
  await page.waitForTimeout(400);
  const kept = await page.getByText(MARK, { exact: false }).count();
  if (kept > 0 && (await tid('reference-pane').count()))
    ok('fold → unfold kept the unsaved draft text and the open Reference pane');
  else fail(`draft or pane lost across resize (text hits ${kept})`);
  await page.waitForTimeout(500);
  await shot('02-tablet-editor-split-pane');

  // D-06A: rail tab switching inside the root pager (instant, no drag capture on wide windows).
  await page.goto(WRITER);
  await tid('nav-rail').waitFor({ timeout: 20000 });
  const railOn = (k) =>
    tid(`rail-${k}`).evaluate((el) => el.getAttribute('aria-selected') === 'true');
  await tid('rail-notes').click();
  await tid('notes-sort').waitFor({ timeout: 10000 });
  await page.waitForTimeout(200);
  const notesOk = (await railOn('notes')) && new URL(page.url()).pathname === '/';
  await tid('rail-search').click();
  await tid('search-field').waitFor({ timeout: 10000 });
  const searchOk = await railOn('search');
  await tid('rail-notes').click();
  await page.waitForTimeout(300);
  if (notesOk && searchOk && (await railOn('notes')))
    ok('FolioNavRail switches Library / Notes / Search inside the root pager');
  else fail(`rail tab switching broken (notes ${notesOk}, search ${searchOk})`);
  if (dir04At) await page.screenshot({ path: `${dir04At}/03-tablet-rail-tabs-intact.png` });
  await page.close();

  // 03 Reader Aa drawer with Calm Mode on.
  const reader = await browser.newPage({
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 1,
  });
  watch(reader);
  await reader.goto(READER);
  await reader.locator('.kn-settings-btn').click({ timeout: 15000 });
  await reader.locator('.kn-sheet').waitFor();
  await reader.locator('[data-testid="calm-mode"]').click();
  const calm = reader.locator('[data-testid="calm-mode"]');
  if ((await calm.getAttribute('aria-checked')) === 'true') ok('Reader Calm Mode switches on');
  else fail('Calm Mode switch did not turn on');
  const stored = await reader.evaluate(() => JSON.parse(localStorage.getItem('kn:prefs') ?? '{}'));
  if (stored.calmMode === true && stored.tier === 'auto')
    ok('Calm Mode persists without touching tier');
  else fail(`unexpected stored prefs ${JSON.stringify(stored)}`);
  await reader.waitForTimeout(300);
  const dim = await reader.locator('[data-testid="settings-spectacle"].kn-overridden').count();
  if (dim === 1) ok('Calm Mode dims the SPECTACLE / SOUND drawer sections');
  else fail('Calm Mode did not dim the SPECTACLE section');
  if (shotsAt) await reader.screenshot({ path: `${shotsAt}/03-reader-calm-mode-settings.png` });

  if (errors.length) fail(`console errors:\n  ${errors.join('\n  ')}`);
  else ok('tablet pack: zero console errors');
  await browser.close();
} catch (err) {
  fail(String(err).split('\n').slice(0, 3).join(' | '));
} finally {
  writer.closeAllConnections();
  writer.close();
  await stopReader();
}
process.exit(process.exitCode ?? 0);
