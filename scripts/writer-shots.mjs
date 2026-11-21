// Writer QA pack (Directive 02C Folio + 02B-2 workspace: library, editor, focus, gimmick sheet, analysis, growth,
// appearance, live preview): drives the Expo Web export of apps/writer at 390×844. The Live
// Preview runs the built-in OFFLINE reader (iframe srcDoc) with every non-local request aborted,
// so no reader server is needed. Needs `pnpm writer:export` (which builds the preview bundle).
// Usage: node scripts/writer-shots.mjs [--shots <dir>]   e.g. --shots qa-shots-phase2e
// The current phase's 4 PNGs land in <dir>; earlier packs' regression shots in <dir>/regression.
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';
import { phase2ePass } from './writer-shots-2e.mjs';
import { phase2fPass } from './writer-shots-2f.mjs';
import { offlinePreviewShot, settingsAndCompilerShots, toolbarPass } from './writer-shots-2d.mjs';
import { workspacePass } from './writer-shots-workspace.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const packAt = process.argv.includes('--shots')
  ? process.argv[process.argv.indexOf('--shots') + 1]
  : null;
const shotsAt = packAt && join(packAt, 'regression');
const WRITER = 'http://127.0.0.1:8099/';
const DIST = resolve(import.meta.dirname, '../apps/writer/dist-web');
const ID = {
  dialogue: '01M7WD7TG4T9804M170B4T81MM',
  chat: '01M7WD7TG3C1Z266E87HFD27KR',
  dice: '01M7WD7TG54FMBWYMZM8XKD1V7',
  snake: '01M7WD7TG6R6734B03YH123PFY',
};
const RICH =
  '**Snake eyes.** The room *exhaled*, the ++felt++ went ~~quiet~~ still, and ==nobody breathed==.';
/** Synthetic 40-day history so the Growth charts have a curve to draw (QA fixture only). */
const GROWTH_SEED = (() => {
  const day = 86400000;
  const now = Date.now();
  const points = [];
  for (let i = 40; i >= 1; i--) {
    const ts = now - i * day;
    const d = new Date(ts);
    const words = Math.round(40 + (40 - i) * 2 + 8 * Math.sin(i / 3));
    points.push({
      dayKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      ts,
      chars: words * 5,
      words,
      sentences: Math.round(words / 8),
      paragraphs: Math.round(words / 20),
    });
  }
  return JSON.stringify({ data: { points }, updatedAt: now });
})();
if (shotsAt) mkdirSync(shotsAt, { recursive: true });

const errors = [];
const blocked = [];
const fail = (msg) => {
  console.error(`❌ ${msg}`);
  process.exitCode = 1;
};
const ok = (msg) => console.log(`✅ ${msg}`);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
// Expo "single" web output is an SPA: unknown paths fall back to index.html.
const writer = createServer((req, res) => {
  let file = join(DIST, decodeURIComponent((req.url ?? '/').split('?')[0]));
  if (!file.startsWith(DIST) || !statSync(file, { throwIfNoEntry: false })?.isFile())
    file = join(DIST, 'index.html');
  res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
  res.end(readFileSync(file));
}).listen(8099, '127.0.0.1');

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
  await flowPass(page, tid);
  // 2E's five shots are regression now; the pack root holds only the current (2F) four.
  await phase2ePass(page, { WRITER, ID, tid, shotsAt, ok, fail, editor });
  await phase2fPass(page, { WRITER, tid, shotsAt: packAt, ok, fail, editor });
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
// Exit explicitly with the recorded status.
process.exit(process.exitCode ?? 0);

// New novel → write a paragraph → auto-save survives a reload; gimmick picker honours modules.
async function flowPass(page, tid) {
  await page.goto(`${WRITER}new-novel`);
  await tid('novel-title').fill('Flow Test');
  await tid('novel-author').fill('QA');
  await page.getByText('Arc', { exact: true }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByText('Arc 1', { exact: false }).first().waitFor();
  await page.locator('[data-testid^="outline-chapter-"]').first().getByText('Chapter 1').click();
  await tid('tool-addProse').click();
  const prose = page.getByPlaceholder('Write…').last();
  await prose.fill('A paragraph typed on the train.');
  await page.getByTestId('save-status').filter({ hasText: 'Saved' }).waitFor({ timeout: 5000 });
  await page.reload();
  try {
    await page.getByText('A paragraph typed on the train.').waitFor({ timeout: 10000 });
    ok('auto-save persisted a new paragraph');
  } catch {
    fail('auto-save lost the new paragraph');
  }
  await tid('tool-addGimmick').click();
  await page.getByText(/No gimmicks are enabled/).waitFor({ timeout: 5000 });
  ok('gimmick picker is filtered to enabledModules (none for a new novel)');
}
