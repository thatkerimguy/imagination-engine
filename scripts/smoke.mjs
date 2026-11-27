// Browser smoke test + QA pack (OVERHAUL-04). Needs `pnpm build` first and Playwright Chromium.
// Usage: node scripts/smoke.mjs [--shots <dir>]
//   reader pass   Chrome Tide 100% on Gimmick v2 (audio-bed, chat-thread, bespoke-3d dice)
//   preview pass  the writer live-preview bridge (scripts/smoke-preview.mjs)
//   engines pass  14 engines × 3 tiers × 20 leak runs + live Calm proofs (lib/smoke-engines.mjs)
//   sheets pass   360 px contact sheets, overflow checks, QA shots 01-02 (lib/smoke-sheets.mjs)
import { createRequire } from 'node:module';
import { chatState } from './lib/chat-state.mjs';
import { enginesPass } from './lib/smoke-engines.mjs';
import { sheetsPass } from './lib/smoke-sheets.mjs';
import { previewPass } from './smoke-preview.mjs';
import { startPreviewServer } from './smoke-server.mjs';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error(
    'Playwright is not installed. Run: npm i -g playwright && npx playwright install chromium',
  );
  process.exit(2);
}
const shotsAt = process.argv.includes('--shots')
  ? process.argv[process.argv.indexOf('--shots') + 1]
  : null;
const BASE = 'http://127.0.0.1:4173/';
const stopServer = await startPreviewServer(BASE);
const errors = [];
const fail = (msg) => {
  console.error(`❌ ${msg}`);
  process.exitCode = 1;
};
const ok = (msg) => console.log(`✅ ${msg}`);
const ctx = { ok, fail, shotsAt };

try {
  const browser = await chromium.launch({
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const newPage = async (scale = 2) => {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: scale,
      hasTouch: true,
    });
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    return page;
  };
  const shot = (page, name) => shotsAt && page.screenshot({ path: `${shotsAt}/${name}.png` });

  await readerPass(await newPage(), shot);
  await previewPass(await newPage(), BASE, { ok, fail, shot });
  await enginesPass(newPage, BASE, ctx);
  await sheetsPass(newPage, BASE, ctx);
  await lazyGl(await newPage(1));

  if (errors.length) fail(`console errors:\n  ${errors.join('\n  ')}`);
  else ok('zero console errors');
  // SwiftShader's GPU process can wedge browser.close(); never let that hang the run.
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 10000))]);
} finally {
  stopServer();
}
process.exit(process.exitCode ?? 0);

function stageShown(page) {
  return page.waitForFunction(
    () => {
      const c = document.querySelector('.kn-stage-gl');
      return !!c && getComputedStyle(c).display === 'block';
    },
    null,
    { timeout: 20000 },
  );
}
function stageHidden(page) {
  return page.waitForFunction(
    () => {
      const c = document.querySelector('.kn-stage-gl');
      return !c || getComputedStyle(c).display === 'none';
    },
    null,
    { timeout: 10000 },
  );
}

async function readerPass(page, shot) {
  await page.goto(BASE);
  await page.getByText('Chrome Tide').click();
  await page.getByText('Low Tide').click();
  await page.getByText('Snake Eyes').click();
  await page.getByText('Start chapter · Sound on').click();
  const v1 = await page.evaluate(() => document.querySelectorAll('.kn-module-notice').length);
  if (v1) fail(`Chrome Tide shows ${v1} module notices`);
  // Beat 1: ivory snake eyes on the shared WebGL stage, thrown automatically.
  await page.mouse.wheel(0, 900);
  await page
    .locator('[data-engine="bespoke-3d"]')
    .first()
    .evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await stageShown(page);
  await page.waitForTimeout(150);
  await shot(page, '10-chrome-tide-dice-midroll');
  const first = page.locator('[data-engine="bespoke-3d"][data-state="done"]').first();
  await first.waitFor({ timeout: 20000 });
  const kestrel = await chatState(page);
  if (kestrel.pending === 0 && kestrel.last === "Don't relax.")
    ok('Chrome Tide v2: KESTREL-9 chat-thread finished before the dice landed');
  else fail(`dice landed while KESTREL-9 was incomplete: ${JSON.stringify(kestrel)}`);
  await stageHidden(page);
  const t1 = (await first.locator('.kn-e-bespoke-3d__result').textContent()) ?? '';
  if (/\[1, 1\]/.test(t1)) ok(`beat 1 (bespoke-3d): “${t1}”, stage cleared after handoff`);
  else fail(`scripted [1,1] did not land: “${t1}”`);
  const beds = await page.locator('[data-engine="audio-bed"]').count();
  if (beds >= 1) ok(`Chrome Tide v2: ${beds} audio-bed cue(s) mounted (rain-on-tin, barroom-hum)`);
  else fail('no audio-bed cue mounted');
  // Beat 3: obsidian boxcars on tap.
  await page.mouse.wheel(0, 900);
  await page.locator('.kn-continue').click({ timeout: 20000 });
  const roll = page.getByRole('button', { name: 'Roll the dice' });
  await page.locator('[data-engine="bespoke-3d"]').nth(1).waitFor({ timeout: 20000 });
  await page
    .locator('[data-engine="bespoke-3d"]')
    .nth(1)
    .evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await roll.click({ timeout: 20000 });
  const second = page.locator('[data-engine="bespoke-3d"][data-state="done"]').nth(1);
  await second.waitFor({ timeout: 25000 });
  await stageHidden(page);
  const t2 = (await second.locator('.kn-e-bespoke-3d__result').textContent()) ?? '';
  if (/\[6, 6\]/.test(t2)) ok(`beat 3: “${t2}” landed on tap, overlay cleared`);
  else fail(`scripted [6,6] did not land: “${t2}”`);
  await shot(page, '11-chrome-tide-post-handoff');
  if (!(await page.evaluate(() => localStorage.getItem('kn:bookmark:vertical-slice'))))
    fail('no bookmark saved');
  await page.close();
}

async function lazyGl(page) {
  await page.goto(`${BASE}sandbox/?blueprint=cyberbrain-link&tier=high`);
  await page.getByRole('button', { name: 'Trigger Beat' }).click();
  await page.waitForTimeout(4500);
  const line = (await page.locator('.sb-stats').textContent()) ?? '';
  const three = await page.evaluate(() =>
    performance.getEntriesByType('resource').some((r) => /dice-mesh|high-/.test(r.name)),
  );
  if (/GL contexts made 0 · live no/.test(line) && !three)
    ok(`cyberbrain-link never loads three.js or WebGL: ${line.split('\n').at(-1)}`);
  else fail(`cyberbrain-link loaded WebGL: ${line} (three chunk fetched: ${three})`);
  await page.close();
}
