// Browser smoke test + QA screenshot pack (DIRECTIVE 01 acceptance and the review handoff).
// Needs `pnpm build` first and Playwright with Chromium (`npx playwright install chromium`).
// Usage: node scripts/smoke.mjs [--shots <dir>]
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { diceMaterialsPass } from './smoke-dice-materials.mjs';
import { previewPass } from './smoke-preview.mjs';

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
// Windows needs a shell to find pnpm.cmd, and a tree kill to stop the server behind it.
const win = process.platform === 'win32';
const server = spawn('pnpm', ['--filter', '@kn/reader', 'preview'], {
  stdio: 'ignore',
  shell: win,
});
const stopServer = () =>
  win ? spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']) : server.kill();
const errors = [];
const fail = (msg) => {
  console.error(`❌ ${msg}`);
  process.exitCode = 1;
};
const ok = (msg) => console.log(`✅ ${msg}`);

try {
  await waitFor(BASE);
  const browser = await chromium.launch({
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  // Shots for people use 2× density; the long sandbox runs use 1× because a software GPU at 2×
  // renders slowly enough to stretch every throw's timeline.
  const newPage = async (scale = 2) => {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: scale,
      hasTouch: true,
    });
    // Settled dice call navigator.vibrate(); record it so shots can be timed to the hold window.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'vibrate', {
        value: () => ((window.__settled = performance.now()), true),
      });
    });
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    return page;
  };
  const shot = (page, name) => shotsAt && page.screenshot({ path: `${shotsAt}/${name}.png` });
  const settled = (page) => page.waitForFunction(() => window.__settled, null, { timeout: 15000 });
  const resetSettled = (page) => page.evaluate(() => (window.__settled = 0));

  await readerPass(await newPage(), shot, settled, resetSettled);
  await sandboxPass(await newPage(1), shot, settled, resetSettled);
  await warmPass(await newPage(), shot, settled);
  await previewPass(await newPage(), BASE, { ok, fail, shot });
  await diceMaterialsPass(newPage, BASE, { ok, fail, shot });
  const fresh = await newPage();
  await fresh.goto(`${BASE}sandbox/?module=gits-cyberbrain-chat&tier=high`);
  await fresh.getByRole('button', { name: 'Trigger Beat' }).click();
  await fresh.waitForTimeout(4500);
  const lazy = await fresh.locator('.sb-stats').textContent();
  if (/GL contexts made 0 · live no/.test(lazy ?? ''))
    ok(`cyberbrain keeps WebGL unloaded: ${lazy}`);
  else fail(`cyberbrain created WebGL: ${lazy}`);
  await shot(fresh, '08-sandbox-cyberbrain-lazy-gl');

  if (errors.length) fail(`console errors:\n  ${errors.join('\n  ')}`);
  else ok('zero console errors');
  await browser.close();
} finally {
  stopServer();
}

async function readerPass(page, shot, settled, resetSettled) {
  await page.goto(BASE);
  await page.getByText('Chrome Tide').click();
  await page.getByText('Low Tide').click();
  await page.getByText('Snake Eyes').click();
  await page.getByText('Start chapter · Sound on').click();
  // Beat 1: ivory snake eyes, thrown automatically.
  await page.mouse.wheel(0, 900);
  await page.locator('.kn-stage-gl:not([hidden])').waitFor({ timeout: 20000 });
  await page.waitForTimeout(120);
  await shot(page, '01-ivory-dice-midroll');
  if (await page.locator('.kn-dice-result').count()) fail('result chip visible while dice roll');
  await settled(page);
  await page.waitForTimeout(250);
  await shot(page, '02-ivory-dice-settled');
  // Beats are queued in document order: the thought-link must be complete before dice land.
  const kestrel = await page.evaluate(() => ({
    pending: document.querySelectorAll('.kn-cbc li.pending').length,
    last: document.querySelector('.kn-cbc li:last-child')?.textContent,
  }));
  if (kestrel.pending === 0 && kestrel.last === "Don't relax.")
    ok('KESTREL-9 finished all 3 lines before the dice settled');
  else fail(`dice settled while KESTREL-9 was incomplete: ${JSON.stringify(kestrel)}`);
  await shot(page, '01-kestrel-complete-before-dice');
  if (await page.locator('.kn-dice-result').count()) fail('result chip visible during hold');
  const chip1 = page.locator('.kn-dice-result').first();
  await chip1.waitFor({ timeout: 6000 });
  await page.locator('.kn-stage-gl[hidden]').waitFor({ state: 'attached', timeout: 3000 });
  await page.waitForTimeout(200);
  await shot(page, '03-ivory-post-handoff');
  if (!/Snake eyes/.test((await chip1.textContent()) ?? '')) fail('scripted [1,1] did not land');
  else ok('beat 1: [1,1] landed, chip shown after the dice cleared');
  // Beat 2 gate, then the header fade around the emphasis line.
  await page.locator('.kn-continue').click({ timeout: 6000 });
  await page.waitForTimeout(900);
  // Park "Snake eyes. The room exhaled." half under the bar so the fade scrim is on show.
  const line = page.getByText('Snake eyes. The room exhaled.');
  await page.evaluate(() =>
    document.querySelector('.kn-chapter').style.setProperty('padding-bottom', '100dvh'),
  );
  await line.evaluate((el) => scrollBy(0, el.getBoundingClientRect().top - 62));
  await page.waitForTimeout(300);
  await shot(page, '04-header-scroll-fade');
  // Beat 3: obsidian boxcars on tap.
  await resetSettled(page);
  await page.mouse.wheel(0, 900);
  await page.locator('.kn-continue').click({ timeout: 20000 });
  await page.getByRole('button', { name: /throw/ }).click({ timeout: 15000 });
  await settled(page);
  const chip2 = page.locator('.kn-dice-result').nth(1);
  await chip2.waitFor({ timeout: 6000 });
  await page.locator('.kn-stage-gl[hidden]').waitFor({ state: 'attached', timeout: 3000 });
  await page
    .getByText(/^Boxcars\. The Dealer/)
    .evaluate((el) => scrollBy(0, el.getBoundingClientRect().top - 330));
  await page.waitForTimeout(300);
  await shot(page, '05-obsidian-post-handoff');
  if (!/Boxcars/.test((await chip2.textContent()) ?? '')) fail('scripted [6,6] did not land');
  else ok('beat 3: [6,6] landed on tap, overlay cleared');
  if (!(await page.evaluate(() => localStorage.getItem('kn:bookmark:vertical-slice'))))
    fail('no bookmark saved');
}

async function sandboxPass(page, shot, settled, resetSettled) {
  const stats = page.locator('.sb-stats');
  const trigger = page.getByRole('button', { name: 'Trigger Beat' });
  await page.goto(`${BASE}sandbox/?module=bl-dice-3d&tier=high`);
  await page.waitForTimeout(600);
  await shot(page, '03-sandbox-top-line-crisp');

  // Determinism: 10 scripted throws must all read [1,1].
  for (let i = 0; i < 10; i++) {
    await trigger.click();
    const text = await page.locator('.kn-dice-result').textContent({ timeout: 10000 });
    if (!/Snake eyes/.test(text ?? '')) return fail(`sandbox throw ${i + 1} landed "${text}"`);
  }
  ok('10/10 scripted sandbox throws landed [1,1]');

  // Tap-to-dismiss: with a 6 s hold, a tap right after settling hands off almost at once.
  await page
    .getByText('Hold result')
    .locator('..')
    .locator('input[type=range]')
    .evaluate((el) => {
      el.value = '6';
      el.dispatchEvent(new Event('change'));
    });
  await resetSettled(page);
  await trigger.click();
  await settled(page);
  const tappedAt = Date.now();
  await page.mouse.click(30, 400);
  await page.locator('.kn-dice-result').waitFor({ timeout: 6000 });
  const waited = Date.now() - tappedAt;
  if (waited < 1500) ok(`tap during hold skipped to handoff in ${waited} ms (hold was 6 s)`);
  else fail(`tap did not skip the hold (${waited} ms)`);
  await page.waitForTimeout(800);

  // Context loss mid-throw: the beat must still finish, hand off and release its lease.
  await page.reload();
  await trigger.click();
  await page.locator('.kn-stage-gl:not([hidden])').waitFor({ timeout: 10000 });
  await page.evaluate(() =>
    document
      .querySelector('.kn-stage-gl')
      .getContext('webgl2')
      .getExtension('WEBGL_lose_context')
      .loseContext(),
  );
  await page.locator('.kn-dice-result').waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);
  const afterLoss = await page.evaluate(() => document.querySelector('.sb-stats').textContent);
  await trigger.click();
  await page.locator('.kn-dice-result').waitFor({ timeout: 10000 });
  await page.waitForTimeout(1000);
  const recovered = await stats.textContent();
  if (/GL contexts made 2/.test(recovered ?? '') && /leases 0/.test(recovered ?? ''))
    ok(`context loss: beat finished, fresh context next time (${recovered})`);
  else fail(`context loss not recovered: after loss "${afterLoss}", next "${recovered}"`);

  // ×20 per tier, with telemetry before / during / after.
  for (const tier of ['high', 'lite', 'reduced']) {
    await page.goto(`${BASE}sandbox/?module=bl-dice-3d&tier=${tier}`);
    await page.waitForTimeout(1200);
    const before = await stats.textContent();
    await page.getByRole('button', { name: '×20' }).click();
    await page.waitForTimeout(tier === 'reduced' ? 300 : 2500);
    const during = await page.evaluate(() => document.querySelector('.sb-stats').textContent);
    await stats.filter({ hasText: /leak/i }).waitFor({ timeout: 300000 });
    await page.waitForTimeout(2000);
    const after = await stats.textContent();
    console.log(
      `  ${tier} before: ${before}\n  ${tier} during: ${during}\n  ${tier} after:  ${after}`,
    );
    if (!after?.includes('No leaks')) fail(`leak check failed on ${tier}`);
    if (tier === 'high') {
      await shot(page, '07-sandbox-post-x20-telemetry');
      await shot(page, '04-post-x20-high-regression');
    }
    if (tier === 'reduced') {
      await trigger.click();
      await page.locator('.kn-dice-result').waitFor();
      await shot(page, '06-sandbox-reduced-mode');
    }
  }
}

async function warmPass(page, shot, settled) {
  await page.addInitScript(() =>
    localStorage.setItem(
      'kn:prefs',
      JSON.stringify({ fontScale: 1, theme: 'warm', tier: 'auto', sound: true }),
    ),
  );
  await page.goto(`${BASE}sandbox/?module=bl-dice-3d&tier=high`);
  await page.getByRole('button', { name: 'Trigger Beat' }).click();
  await page.locator('.kn-stage-gl:not([hidden])').waitFor({ timeout: 10000 });
  await page.waitForTimeout(150);
  await shot(page, '02a-warm-theme-dice-midroll');
  await settled(page);
  await page.waitForTimeout(200);
  await shot(page, '02-warm-theme-dice-shadows');
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
  throw new Error('preview server did not start');
}
