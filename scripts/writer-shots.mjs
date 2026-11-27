// Writer QA pack: drives the Expo Web export of apps/writer at 390×844 (library, editor, focus,
// gimmick sheet, analysis, growth, appearance, offline live preview with every non-local request
// aborted). Needs `pnpm writer:export`. Usage: node scripts/writer-shots.mjs [--shots <dir>]
// The 3 OVERHAUL-04 writer PNGs (03 Chrome Tide Calm, 04 catalog + form, 05 DNA Studio) land in
// <dir>; every earlier pack lands in <dir>/regression (the tablet pack needs `pnpm build`).
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { serveSpa } from './lib/spa-server.mjs';
import { corePass } from './lib/shots-runner.mjs';
import { ID, skipOnboarding } from './lib/writer-fixtures.mjs';
import { phase2ePass } from './writer-shots-2e.mjs';
import { flowPass } from './writer-shots-flow.mjs';
import { phase2fPass } from './writer-shots-2f.mjs';
import { settingsAndCompilerShots, toolbarPass } from './writer-shots-2d.mjs';
import { workspacePass } from './writer-shots-workspace.mjs';
import { phase4aPass } from './writer-shots-4a.mjs';
import { dir05Pass } from './writer-shots-dir05.mjs';
import { dir06aPass } from './writer-shots-dir06a.mjs';
import { dir07Pass } from './writer-shots-dir07.mjs';
import { ov01Pass } from './writer-shots-ov01.mjs';
import { ov02aPass } from './writer-shots-overhaul02a.mjs';
import { ov03Pass } from './writer-shots-ov03.mjs';
import { ov04Pass } from './writer-shots-ov04.mjs';

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
  await skipOnboarding(page);
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

  const editor = async () => {
    await page.goto(`${WRITER}novel/vertical-slice/chapter/s01/ch01`);
    await tid(`pill-${ID.chat}`).waitFor({ timeout: 20000 });
  };
  const closeSheet = () => page.getByRole('button', { name: 'Close sheet' }).last().click();

  await corePass(page, { WRITER, tid, shot, ok, fail, editor, closeSheet, blocked });
  await workspacePass(page, { WRITER, shotsAt, tid, ok, fail, editor });
  await toolbarPass(page, { tid, editor, shotsAt, ok, fail });
  await settingsAndCompilerShots(page, { WRITER, tid, shotsAt, ok, fail });
  await flowPass(page, { WRITER, tid, ok, fail });
  await phase2ePass(page, { WRITER, ID, tid, shotsAt, ok, fail, editor });
  await phase2fPass(page, { WRITER, tid, shotsAt, ok, fail, editor });
  await phase4aPass(page, { WRITER, packAt: shotsAt, tid, ok, fail, editor });
  await dir05Pass(page, { WRITER, packAt: shotsAt, tid, ok, fail, editor });
  await dir06aPass(page, { WRITER, packAt: shotsAt, tid, ok, fail });
  // Every earlier pack is regression now; the pack root holds the OVERHAUL-04 shots.
  await dir07Pass(page, { WRITER, packAt: shotsAt, shotsAt, tid, ok, fail, editor });
  await ov01Pass(browser, { WRITER, packAt: shotsAt, ok, fail });
  await ov02aPass(browser, { WRITER, packAt: shotsAt, ok, fail });
  await ov03Pass(browser, { WRITER, packAt: shotsAt, ok, fail });
  await ov04Pass(browser, { WRITER, packAt, ok, fail });
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
// Publish E2E + DIRECTIVE-04 ToS / Report abuse (regression; the 2 D-04 shots go to the pack root).
const run = (script, args) =>
  spawnSync(process.execPath, [join(import.meta.dirname, script), ...args], { stdio: 'inherit' });
const pack3 = shotsAt && run('smoke-publish.mjs', ['--shots', shotsAt, '--ugc-shots', shotsAt]);
if (pack3 && pack3.status !== 0) fail('publish pack (smoke-publish.mjs) failed');
// D-03 tablet / Calm Mode + D-04 / 06A tablet shots (all regression now).
const tablet = run(
  'writer-shots-tablet.mjs',
  packAt ? ['--shots', shotsAt, '--dir04', shotsAt] : [],
);
if (tablet.status !== 0) fail('tablet pack (writer-shots-tablet.mjs) failed');
// Exit explicitly with the recorded status.
process.exit(process.exitCode ?? 0);
