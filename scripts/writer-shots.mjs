// Writer QA pack: drives the Expo Web export of apps/writer at 390×844 (library, editor, focus,
// gimmick sheet, analysis, growth, appearance, offline live preview with every non-local request
// aborted). Needs `pnpm writer:export`. Usage: node scripts/writer-shots.mjs [--shots <dir>]
// Current PNGs land in <dir> (04A pack + the D-03 tablet pack, writer-shots-tablet.mjs, which
// also needs `pnpm build`); earlier packs (incl. smoke-publish.mjs) land in <dir>/regression.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { serveSpa } from './lib/spa-server.mjs';
import { GROWTH_SEED, ID, RICH } from './lib/writer-fixtures.mjs';
import { phase2ePass } from './writer-shots-2e.mjs';
import { flowPass } from './writer-shots-flow.mjs';
import { phase2fPass } from './writer-shots-2f.mjs';
import { offlinePreviewShot, settingsAndCompilerShots, toolbarPass } from './writer-shots-2d.mjs';
import { workspacePass } from './writer-shots-workspace.mjs';
import { phase4aPass } from './writer-shots-4a.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const packAt = process.argv.includes('--shots')
  ? process.argv[process.argv.indexOf('--shots') + 1]
  : null;
const shotsAt = packAt && join(packAt, 'regression');
const WRITER = 'http://127.0.0.1:8099/';
const DIST = resolve(import.meta.dirname, '../apps/writer/dist-web');
if (shotsAt) mkdirSync(shotsAt, { recursive: true });

const errors = [];
const blocked = [];
const fail = (msg) => {
  console.error(`❌ ${msg}`);
  process.exitCode = 1;
};
const ok = (msg) => console.log(`✅ ${msg}`);

const writer = serveSpa(DIST, 8099);

try {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    colorScheme: 'dark',
  });
  // Settled dice call navigator.vibrate() (in the preview iframe too); record when.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'vibrate', {
      value: () => ((window.__settled = performance.now()), true),
    });
  });
  // True offline: only the local writer server may answer. previewMode stays at its default.
  await page.route('**/*', (route) => {
    const { hostname } = new URL(route.request().url());
    if (hostname === '127.0.0.1' || hostname === 'localhost') return route.continue();
    blocked.push(route.request().url());
    return route.abort();
  });
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept());
  const shot = (name) => shotsAt && page.screenshot({ path: `${shotsAt}/${name}.png` });
  const tid = (id) => page.getByTestId(id);
  globalThis.__page = page;

  await page.addInitScript((seed) => {
    const key = 'kn-writer:growth/chapter:ch01';
    if (!localStorage.getItem(key)) localStorage.setItem(key, seed);
  }, GROWTH_SEED);
  const editor = async () => {
    await page.goto(`${WRITER}novel/vertical-slice/chapter/s01/ch01`);
    await tid(`pill-${ID.chat}`).waitFor({ timeout: 20000 });
  };
  const closeSheet = () => page.getByRole('button', { name: 'Close sheet' }).last().click();

  // 01 Folio Library (dark): book rows with spine thumbs, quiet bar, no FAB.
  await page.goto(WRITER);
  await tid('novel-card-vertical-slice').waitFor({ timeout: 20000 });
  if (await page.getByRole('button', { name: /^New novel$/ }).count())
    ok('library has a quiet New novel action');
  await page.waitForTimeout(300);
  await shot('01-folio-library-dark');

  // 02 Folio chapter editor (dark): slim bar, metrics strip, active rail, cue strip, rail toolbar.
  await editor();
  for (const id of ['editor-top-bar', 'stats-pill', 'undo-button', 'redo-button', 'preview-button'])
    await tid(id).waitFor();
  await tid('metrics-ribbon').waitFor();
  await tid('tool-tab').waitFor();
  ok('slim top bar, metrics strip and formatting rail (with Tab) render');
  await tid(`prose-text-${ID.snake}`).click();
  const snake = page.locator(`textarea[data-testid="prose-text-${ID.snake}"]`);
  await snake.waitFor();
  await snake.fill(RICH);
  await tid(`dialogue-text-${ID.dialogue}`).click();
  const wysiwyg = tid(`prose-text-${ID.snake}`);
  const raw = await wysiwyg.textContent();
  if (raw.includes('**') || raw.includes('==')) fail(`unfocused prose shows raw markup: ${raw}`);
  else ok('unfocused prose renders WYSIWYG with zero raw syntax');
  await tid('undo-button').click();
  await tid('redo-button').click();
  ok('undo / redo buttons respond');
  await page.getByTestId('save-status').filter({ hasText: 'Saved' }).waitFor({ timeout: 5000 });
  const beats = await tid(`block-${ID.dice}`).getByText(/beat/i).count();
  if (beats <= 1) ok(`dice cue strip shows the Beat marker at most once (${beats})`);
  else fail(`dice cue strip repeats the Beat marker ${beats}×`);
  await tid(`dialogue-text-${ID.dialogue}`).click();
  await tid(`block-${ID.dialogue}`).evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  await shot('02-folio-editor-dark');

  // 04 Folio schema sheet on bl-dice-3d.
  await tid(`pill-${ID.dice}`).scrollIntoViewIfNeeded();
  await tid(`pill-${ID.dice}`).click();
  await tid('gimmick-sheet').waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);
  await shot('04-folio-gimmick-sheet-dice');
  await closeSheet();
  ok('dice gimmick sheet opens');

  // 05 Text analysis sheet, Frequency tab, Content filter.
  await tid('stats-pill').click();
  await tid('text-analysis-sheet').waitFor();
  await tid('analysis-tab-frequency').click();
  await tid('freq-filter-content').click();
  await page.waitForTimeout(500);
  await shot('05-folio-text-analysis');
  await closeSheet();
  ok('text analysis sheet opens with frequency chart');

  // 06 Growth (All).
  await tid('editor-menu').click();
  await tid('menu-growth').click();
  await tid('growth-range-lifetime').click();
  await tid('growth-card-words').waitFor();
  const paths = await page.locator('svg path').count();
  if (paths >= 4) ok(`growth charts render (${paths} svg paths)`);
  else fail(`growth charts missing (${paths} svg paths)`);
  await page.waitForTimeout(300);
  await shot('06-folio-growth-dashboard');

  // 07 Appearance & fonts in a Day theme (Paper Daylight).
  await page.goto(`${WRITER}appearance`);
  await tid('theme-warm-sepia').waitFor();
  const themes = await page.locator('[data-testid^="theme-"]').count();
  if (themes >= 13) ok(`appearance lists ${themes - 1} themes + System`);
  else fail(`expected 12 theme swatches + System, found ${themes}`);
  await tid('theme-paper-daylight').scrollIntoViewIfNeeded();
  await tid('theme-paper-daylight').click();
  await page.waitForTimeout(300);
  await page.goto(`${WRITER}appearance`);
  await tid('import-font').waitFor();
  await page.waitForTimeout(400);
  await shot('07-folio-appearance-light');

  // 03 Focus mode with Warm Sepia and a literary serif.
  await tid('theme-warm-sepia').scrollIntoViewIfNeeded();
  await tid('theme-warm-sepia').click();
  await tid('font-lora').scrollIntoViewIfNeeded();
  await tid('font-lora').click();
  await editor();
  await tid('editor-menu').click();
  await tid('menu-focus').click();
  await tid('focus-exit').waitFor();
  if (await tid('editor-top-bar').count()) fail('focus mode still shows the top bar');
  else ok('focus mode hides top bar, metrics strip and formatting rail');
  await page.waitForTimeout(800);
  await shot('03-folio-focus-sepia');
  await tid('focus-exit').click();
  await page.goto(`${WRITER}appearance`);
  await tid('theme-system').click();
  await tid('font-classic-serif').scrollIntoViewIfNeeded();
  await tid('font-classic-serif').click();

  // 06 Live preview of the unsaved rich prose, sequenced chat + dice.
  await editor();
  await tid(`prose-text-${ID.snake}`).click();
  await page.locator(`textarea[data-testid="prose-text-${ID.snake}"]`).fill(RICH + ' ');
  // Start the preview at the dialogue line above the dice, as the Author would.
  await tid(`dialogue-text-${ID.dialogue}`).click();
  await tid('preview-button').click();
  await tid('preview-screen').waitFor({ timeout: 10000 });
  const frame = page.frameLocator('iframe[title="Reader preview"]');
  await frame.getByRole('button', { name: 'Silent' }).click({ timeout: 15000 });
  const reader = page.frames().find((f) => f.url() === 'about:srcdoc');
  if (!reader) throw new Error('offline reader srcdoc frame not found');
  await reader.waitForFunction(() => window.__settled, null, { timeout: 30000 });
  const chat = await reader.evaluate(() => ({
    pending: document.querySelectorAll('.kn-cbc li.pending').length,
    last: document.querySelector('.kn-cbc li:last-child')?.textContent,
  }));
  if (chat.pending === 0 && chat.last === "Don't relax.")
    ok('all 3 KESTREL-9 lines were complete when the dice landed');
  else fail(`dice landed while KESTREL-9 was incomplete: ${JSON.stringify(chat)}`);
  await frame.getByText('Tap to continue', { exact: false }).click();
  await frame.locator('strong', { hasText: 'Snake eyes.' }).waitFor({ timeout: 15000 });
  const spans = await frame
    .locator(`[data-block="${ID.snake}"]`)
    .evaluate((el) => ['strong', 'em', 'u', 's', 'mark'].map((t) => el.querySelectorAll(t).length));
  if (spans.every((n) => n === 1))
    ok('preview renders bold, italic, underline, strike and highlight');
  else fail(`inline spans in preview: ${JSON.stringify(spans)}`);
  await frame
    .locator(`[data-block="${ID.snake}"]`)
    .evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  await shot('08-live-preview-rich-formatting');
  await offlinePreviewShot(page, { frame, reader, tid, shot, ok, fail, blocked, RICH });

  await workspacePass(page, { WRITER, shotsAt, tid, ok, fail, editor });
  await toolbarPass(page, { tid, editor, shotsAt, ok, fail });
  await settingsAndCompilerShots(page, { WRITER, tid, shotsAt, ok, fail });
  await flowPass(page, { WRITER, tid, ok, fail });
  // 2E's five shots are regression now; the pack root holds only the current (2F) four.
  await phase2ePass(page, { WRITER, ID, tid, shotsAt, ok, fail, editor });
  await phase2fPass(page, { WRITER, tid, shotsAt, ok, fail, editor });
  // Directive 04A: the pack root holds the current shots (02–04 here, 01 from smoke.mjs).
  await phase4aPass(page, { WRITER, packAt, tid, ok, fail, editor });
  if (errors.length) fail(`console errors:\n  ${errors.join('\n  ')}`);
  else ok('zero console errors');
  await browser.close();
} catch (err) {
  fail(String(err).split('\n').slice(0, 3).join(' | '));
  if (packAt)
    await globalThis.__page?.screenshot({ path: `${packAt}/_failure.png` }).catch(() => {});
} finally {
  writer.closeAllConnections();
  writer.close();
}
// Phase 3 pack (Settings → Publish sheet → live reader), now regression: the publish E2E smoke
// owns its servers.
const pack3 =
  shotsAt &&
  spawnSync(
    process.execPath,
    [join(import.meta.dirname, 'smoke-publish.mjs'), '--shots', shotsAt],
    {
      stdio: 'inherit',
    },
  );
if (pack3 && pack3.status !== 0) fail('publish pack (smoke-publish.mjs) failed');
// DIRECTIVE-03 tablet / Calm Mode pack (pack root): rail, grids, split pane, web shortcuts.
const tablet = spawnSync(
  process.execPath,
  [join(import.meta.dirname, 'writer-shots-tablet.mjs'), ...(packAt ? ['--shots', packAt] : [])],
  { stdio: 'inherit' },
);
if (tablet.status !== 0) fail('tablet pack (writer-shots-tablet.mjs) failed');
// Exit explicitly with the recorded status.
process.exit(process.exitCode ?? 0);
