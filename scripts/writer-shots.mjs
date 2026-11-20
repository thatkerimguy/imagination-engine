// Writer QA pack (Directive 02 · Pass 2 review): drives the Expo Web export of apps/writer at 390×844, with
// the Live Preview pointed at the built apps/reader. Needs `pnpm build` and `pnpm writer:export`.
// Usage: node scripts/writer-shots.mjs [--shots <dir>]
import { spawn } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const shotsAt = process.argv.includes('--shots')
  ? process.argv[process.argv.indexOf('--shots') + 1]
  : null;
const READER = 'http://127.0.0.1:4173/';
const WRITER = 'http://127.0.0.1:8099/';
const DIST = resolve(import.meta.dirname, '../apps/writer/dist');
const ID = {
  dialogue: '01M7WD7TG4T9804M170B4T81MM',
  chat: '01M7WD7TG3C1Z266E87HFD27KR',
  dice: '01M7WD7TG54FMBWYMZM8XKD1V7',
};
const EDITED = 'House rolls first. Tonight the house rolls loaded.';
const errors = [];
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
const reader = spawn('pnpm', ['--filter', '@kn/reader', 'preview'], { stdio: 'ignore' });

try {
  await waitFor(READER);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  // Settled dice call navigator.vibrate() (in the preview iframe too); record when.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'vibrate', {
      value: () => ((window.__settled = performance.now()), true),
    });
  });
  await page.addInitScript((url) => {
    const key = 'kn-writer:setting/app';
    if (!localStorage.getItem(key))
      localStorage.setItem(key, JSON.stringify({ data: { readerUrl: url }, updatedAt: 0 }));
  }, READER);
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', (d) => d.accept());
  const shot = (name) => shotsAt && page.screenshot({ path: `${shotsAt}/${name}.png` });
  const tid = (id) => page.getByTestId(id);

  // 01 Bookshelf with the first-launch demo seed.
  await page.goto(WRITER);
  await tid('novel-card-vertical-slice').waitFor({ timeout: 20000 });
  await tid('new-novel').waitFor();
  ok('bookshelf shows seeded "Chrome Tide" and New novel');
  await shot('01-m3-bookshelf-dark');

  // 02 Outline + Novel Settings module toggles, side by side in one image.
  await tid('novel-card-vertical-slice').click();
  await tid('outline-season-s01').waitFor();
  const outline = await page.screenshot();
  await page.goto(`${WRITER}novel/vertical-slice/settings`);
  await tid('module-toggle-bl-dice-3d').waitFor();
  await tid('module-toggle-bl-dice-3d').scrollIntoViewIfNeeded();
  const settings = await page.screenshot();
  ok('outline and enabledModules toggles render');
  await sideBySide(browser, [outline, settings], '02-m3-outline-and-settings');

  // 03 Chapter editor.
  await page.goto(`${WRITER}novel/vertical-slice/chapter/s01/ch01`);
  await tid(`pill-${ID.chat}`).waitFor();
  await tid('insert-gimmick').waitFor();
  if (await tid('top-bar-back').isVisible()) ok('chapter editor top bar has a Back button');
  else fail('chapter editor has no Back button');
  const pills = await page.locator('[data-testid^="pill-"]').allTextContents();
  if (pills.some((t) => t.includes('KESTREL-9')) && pills.some((t) => t.includes('D6')))
    ok(`editor pills come from formatCardSummary (${pills.length} pills)`);
  else fail(`unexpected pills: ${JSON.stringify(pills)}`);
  await tid('block-01M7WD7TG0SRH8FFJAF28FHTHC').evaluate((el) => el.scrollIntoView());
  await page.waitForTimeout(300);
  await shot('03-m3-chapter-editor');

  // 04 Dice sheet: scripted → scriptedNumbers visible; random → hidden (showWhen).
  await tid(`pill-${ID.dice}`).click();
  await tid('gimmick-sheet').waitFor();
  // The first label must sit fully below the fixed sheet header (title, then subtitle and divider).
  const header = await page.getByText('3D Dice Throw', { exact: true }).boundingBox();
  const label = await page.getByText('Dice', { exact: true }).boundingBox();
  if (header && label && label.y >= header.y + header.height + 24)
    ok(
      `first field label "Dice" is unclipped (${Math.round(label.y - header.y - header.height)}px below the header)`,
    );
  else fail(`"Dice" label overlaps the sheet header: ${JSON.stringify({ header, label })}`);
  const scripted = page.getByText('Faces that land up');
  await scripted.waitFor();
  await page.getByText('True random', { exact: true }).click();
  if (await scripted.isVisible()) fail('scriptedNumbers still visible in random mode');
  else ok('showWhen hides scriptedNumbers for outcomeMode=random');
  await page.getByText('Scripted', { exact: true }).click();
  await scripted.waitFor();
  await page.getByText('Material').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shot('04-m3-schema-sheet-dice');
  await page.getByRole('button', { name: 'Close sheet' }).click();

  // 05 Cyberbrain sheet: string-list messages + encryption chips.
  await tid(`pill-${ID.chat}`).click();
  await tid('gimmick-sheet').waitFor();
  await page.getByText('SPOOFED', { exact: false }).first().waitFor();
  await page.waitForTimeout(300);
  await shot('05-m3-schema-sheet-chat');
  await page.getByRole('button', { name: 'Close sheet' }).click();

  // 06 Edit a dialogue line (not in the static JSON) and open the Live Preview at that block.
  const line = tid(`block-${ID.dialogue}`).locator('textarea, input').last();
  await line.click();
  await line.fill(EDITED);
  await tid('preview-button').click();
  await tid('preview-screen').waitFor({ timeout: 10000 });
  const frame = page.frameLocator('iframe[title="Reader preview"]');
  await frame.getByRole('button', { name: 'Silent' }).click({ timeout: 15000 });
  await frame.getByText(EDITED).waitFor({ timeout: 15000 });
  ok('live preview renders the edited dialogue line through the reader bridge');
  const reader = page.frames().find((f) => f.url().includes('preview=1'));
  await reader.waitForFunction(() => window.__settled, null, { timeout: 30000 });
  const chat = await reader.evaluate(() => ({
    pending: document.querySelectorAll('.kn-cbc li.pending').length,
    last: document.querySelector('.kn-cbc li:last-child')?.textContent,
  }));
  if (chat.pending === 0 && chat.last === "Don't relax.")
    ok('all 3 KESTREL-9 lines were complete when the dice landed');
  else fail(`dice landed while KESTREL-9 was incomplete: ${JSON.stringify(chat)}`);
  await page.waitForTimeout(250);
  await shot('06-m3-live-preview-sequenced');

  // 07 Light theme: switch Appearance in App Settings, then the chapter editor + dice sheet.
  await page.goto(`${WRITER}settings`);
  await tid('appearance-light').click();
  await page.goto(`${WRITER}novel/vertical-slice/chapter/s01/ch01`);
  await tid(`pill-${ID.dice}`).click();
  await tid('gimmick-sheet').waitFor();
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.waitForTimeout(300);
  await shot('07-m3-light-theme-check');
  await page.getByRole('button', { name: 'Close sheet' }).click();
  ok(`light theme applied (body ${bg})`);
  await page.goto(`${WRITER}settings`);
  await tid('appearance-dark').click();

  await flowPass(page, tid);
  if (errors.length) fail(`console errors:\n  ${errors.join('\n  ')}`);
  else ok('zero console errors');
  await browser.close();
} catch (err) {
  fail(String(err).split('\n')[0]);
} finally {
  reader.kill();
  writer.closeAllConnections();
  writer.close();
}
// pnpm's preview child can outlive kill(); exit explicitly with the recorded status.
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
  await tid('insert-prose').click();
  const prose = page.getByPlaceholder('Write…').last();
  await prose.fill('A paragraph typed on the train.');
  await page.getByTestId('save-status').filter({ hasText: 'Saved' }).waitFor({ timeout: 5000 });
  await page.reload();
  const kept = await page.getByPlaceholder('Write…').last().inputValue({ timeout: 10000 });
  if (kept === 'A paragraph typed on the train.') ok('auto-save persisted a new paragraph');
  else fail(`auto-save lost text: "${kept}"`);
  await tid('insert-gimmick').click();
  await page.getByText(/No gimmicks are enabled/).waitFor({ timeout: 5000 });
  ok('gimmick picker is filtered to enabledModules (none for a new novel)');
}

async function sideBySide(browser, images, name) {
  if (!shotsAt) return;
  const page = await browser.newPage({
    viewport: { width: 780, height: 844 },
    deviceScaleFactor: 2,
  });
  const imgs = images.map((b) => `<img src="data:image/png;base64,${b.toString('base64')}">`);
  await page.setContent(
    `<style>body{margin:0;display:flex;background:#000}img{width:390px;height:844px}</style>${imgs.join('')}`,
  );
  await page.screenshot({ path: `${shotsAt}/${name}.png` });
  await page.close();
}

async function waitFor(url) {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('reader preview server did not start');
}
