// Browser smoke test for DIRECTIVE 01 acceptance: reads the demo chapter end to end on a phone
// viewport, then runs 20 consecutive bl-dice-3d triggers per tier in the sandbox and checks for
// leaks. Needs `pnpm build` first and Playwright with Chromium installed (`npx playwright install chromium`).
// Usage: node scripts/smoke.mjs [--shots <dir>]
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

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
const server = spawn('pnpm', ['--filter', '@kn/reader', 'preview'], { stdio: 'ignore' });
const fail = (msg) => {
  console.error(`❌ ${msg}`);
  process.exitCode = 1;
};

try {
  await waitFor(BASE);
  const browser = await chromium.launch({
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 393, height: 851 },
    deviceScaleFactor: 1,
    hasTouch: true,
  });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  const shot = async (name) => shotsAt && page.screenshot({ path: `${shotsAt}/${name}.png` });

  // Reader: shelf → seasons → chapters → chapter.
  await page.goto(BASE);
  await page.getByText('Chrome Tide').click();
  await page.getByText('Low Tide').click();
  await page.getByText('Snake Eyes').click();
  await shot('1-curtain');
  await page.getByText('Start chapter · Sound on').click();
  const continues = page.locator('.kn-continue');
  for (let gate = 1; gate <= 2; gate++) {
    await page.mouse.wheel(0, 900);
    await continues.waitFor({ timeout: 20000 });
    await shot(`2-gate-${gate}`);
    const chip = page.locator('.kn-dice-result').nth(gate - 1);
    if (gate === 2) {
      await page
        .getByRole('button', { name: /throw/ })
        .scrollIntoViewIfNeeded()
        .catch(() => undefined);
    }
    if (gate === 1) {
      await chip.waitFor({ timeout: 15000 });
      const text = await chip.textContent();
      if (!/Snake eyes/.test(text ?? '')) fail(`scripted [1,1] landed as "${text}"`);
    }
    await continues.click();
  }
  await page.getByRole('button', { name: /throw/ }).click({ timeout: 15000 });
  await page.waitForTimeout(400);
  await shot('3-boxcars-rolling');
  const boxcars = await page.locator('.kn-dice-result').nth(1).textContent({ timeout: 15000 });
  if (!/Boxcars/.test(boxcars ?? '')) fail(`scripted [6,6] landed as "${boxcars}"`);
  const mark = await page.evaluate(() => localStorage.getItem('kn:bookmark:vertical-slice'));
  if (!mark) fail('no bookmark saved');
  console.log(`✅ reader: gates, scripted dice, bookmark ${mark ? 'saved' : 'missing'}`);

  // Sandbox: 20 triggers per tier with leak check.
  for (const tier of ['high', 'lite', 'reduced']) {
    await page.goto(`${BASE}sandbox/?module=bl-dice-3d&tier=${tier}`);
    await page.getByRole('button', { name: '×20' }).click();
    const stats = page.locator('.sb-stats');
    await stats.filter({ hasText: /leak/i }).waitFor({ timeout: 240000 });
    const line = await stats.textContent();
    console.log(`${tier}: ${line}`);
    if (!line?.includes('No leaks')) fail(`sandbox leak check failed on ${tier}`);
    if (tier === 'high') {
      await page.getByRole('button', { name: 'Trigger Beat' }).click();
      await page.waitForTimeout(700);
      await shot('4-sandbox-high');
    }
  }
  for (const id of ['gits-cyberbrain-chat', 'core-ambient-bed']) {
    await page.goto(`${BASE}sandbox/?module=${id}&tier=high`);
    await page.getByRole('button', { name: 'Trigger Beat' }).click();
    await page.waitForTimeout(2500);
    await shot(`5-${id}`);
  }
  if (errors.length) fail(`console errors:\n  ${errors.join('\n  ')}`);
  else console.log('✅ zero console errors');
  await browser.close();
} finally {
  server.kill();
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
