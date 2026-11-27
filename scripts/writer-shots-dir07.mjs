// Directive 07 writer shots (phone, run last by writer-shots.mjs; pack root). Runs the Directive 06
// pass first as regression (its PNGs go to <pack>/regression), then:
//   01 Help & Legal Gimmick Guide: 28 starter blueprints, Feather icons, zero emoji,
//   02 Live Preview rendering a v2 system-notification cue | Book Compiler with Royal Road,
//   03 9:16 BookTok / Reels Teaser Studio | 9:16 Record Mode,
//   04 Settings › Language = Español | Library in Spanish (no horizontal overflow).
import { waitForRepo } from './lib/writer-v2.mjs';
import { dir06Pass } from './writer-shots-dir06.mjs';
import { composite } from './lib/composite.mjs';

const SYS_ID = '01M7WD7TG7SYSTEMBXQ0000000';
const EMOJI = /\p{Extended_Pictographic}/u;
const SYS_BLOCK = {
  id: SYS_ID,
  kind: 'module',
  moduleId: 'frame-hud',
  moduleVersion: 1,
  props: {
    blueprintId: 'system-notification',
    header: '[SYSTEM NOTIFICATION]',
    title: 'Class Evolution Unlocked',
    badge: 'NEW',
    lines: ['STR +3', 'Perception +2', 'New Skill: Iron Nerves (Lv. 1)'],
    footer: '',
    sound: false,
  },
};

/** Puts a v2 System notification cue at the top of ch01 (v2 cues need no enabledModules). */
const seedSystemBox = async (page) => {
  await waitForRepo(page);
  await page.evaluate(async (block) => {
    const repo = globalThis.__knWriterRepo;
    const c = await repo.getChapter('vertical-slice', 's01', 'ch01');
    if (!c.blocks.some((b) => b.id === block.id))
      await repo.saveChapter('vertical-slice', { ...c, blocks: [block, ...c.blocks] });
  }, SYS_BLOCK);
};

const overflowX = (page) =>
  page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);

export async function dir07Pass(page, { WRITER, packAt, shotsAt, tid, ok, fail, editor }) {
  await dir06Pass(page, { WRITER, packAt: shotsAt, tid, ok, fail, editor });
  const path = (name) => `${packAt}/${name}.png`;

  // 01 — Help & Legal Gimmick Guide.
  await page.goto(`${WRITER}help`);
  const guide = tid('help-gimmick-guide');
  await guide.waitFor({ timeout: 15000 });
  const modules = await page.locator('[data-testid^="help-module-"]').count();
  if (modules === 28) ok('Gimmick Guide lists all 28 starter blueprints (generated, no per-gimmick copy)');
  else fail(`Gimmick Guide lists ${modules} modules`);
  const guideText = await guide.innerText();
  if (!EMOJI.test(guideText)) ok('Gimmick Guide rows carry zero emoji (Feather icons only)');
  else fail(`emoji in Gimmick Guide: ${guideText.match(EMOJI)?.[0]}`);
  if (guideText.includes('LitRPG')) ok('Gimmick Guide shows the LitRPG genre label');
  else fail('LitRPG genre label missing');
  await guide.evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(300);
  const helpA = await page.screenshot();
  await tid('help-module-level-up-chord').evaluate((el) => el.scrollIntoView({ block: 'end' }));
  await page.waitForTimeout(300);
  const helpB = await page.screenshot();
  if (packAt) await composite(page, [helpA, helpB], path('01-help-no-emojis-and-28-blueprints'));

  // 02 — Live Preview renders the System window; Compiler offers Royal Road.
  await page.goto(`${WRITER}`);
  await tid('novel-card-vertical-slice').waitFor({ timeout: 20000 });
  await seedSystemBox(page);
  await page.goto(`${WRITER}preview?novel=vertical-slice&season=s01&chapter=ch01&block=${SYS_ID}`);
  await tid('preview-screen').waitFor({ timeout: 15000 });
  const frame = page.frameLocator('iframe[title="Reader preview"]');
  await frame.getByRole('button', { name: 'Silent' }).click({ timeout: 15000 });
  const box = frame.locator('[data-engine="frame-hud"]');
  await box.waitFor({ timeout: 15000 });
  const boxText = await box.evaluate((el) => el.textContent);
  if (/Class Evolution Unlocked/.test(boxText) && /Iron Nerves/.test(boxText))
    ok('Live Preview renders the v2 system-notification cue via the frame-hud engine');
  else fail(`System box text: ${boxText}`);
  await box.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(1200);
  const preview = await page.screenshot();
  await page.goto(`${WRITER}novel/vertical-slice/compile`);
  const rr = tid('export-royalroad');
  await rr.waitFor({ timeout: 15000 });
  if ((await tid('export-royalroad-copy').count()) === 1)
    ok('Compiler offers Royal Road + Copy HTML');
  else fail('Royal Road Copy HTML action missing');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await tid('export-royalroad-copy').click();
  await tid('compile-notice').waitFor({ timeout: 10000 });
  const html = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  if (html.includes('<p><strong>[SYSTEM NOTIFICATION]</strong> NEW</p>') && !/<script|<style/i.test(html))
    ok('Copy HTML puts the blueprint royalRoadHtml template (no script/style) on the clipboard');
  else fail(`Royal Road clipboard: ${html.slice(0, 120)}`);
  await rr.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const compiler = await page.screenshot();
  if (packAt)
    await composite(page, [preview, compiler], path('02-system-notification-preview-and-rr'));

  // 03 — 9:16 Teaser Studio from the Chapter Editor ⋯ menu, then Record Mode.
  await editor();
  await tid('editor-menu').click();
  await tid('menu-create-teaser').click();
  await tid('teaser-studio').waitFor({ timeout: 10000 });
  await tid('teaser-preset-system-glow').click();
  const card = await tid('teaser-card').boundingBox();
  const ratio = card ? card.height / card.width : 0;
  if (Math.abs(ratio - 16 / 9) < 0.02) ok(`teaser card preview is 9:16 (${ratio.toFixed(3)})`);
  else fail(`teaser card ratio ${ratio}`);
  for (const id of ['teaser-export-png', 'teaser-record-frame', 'teaser-quote-input'])
    if ((await tid(id).count()) !== 1) fail(`Teaser Studio is missing ${id}`);
  // The scaled card sits above the controls; bring it back after the preset click scrolled away.
  await tid('teaser-card').evaluate((el) =>
    el.parentElement?.parentElement?.scrollIntoView({ block: 'start' }),
  );
  await page.waitForTimeout(400);
  const studio = await page.screenshot();
  await tid('teaser-record-frame').click();
  await tid('preview-record-stage').waitFor({ timeout: 15000 });
  await tid('preview-record-hide').click();
  await page.waitForTimeout(300);
  if ((await tid('preview-tier').count()) === 0) ok('Record Mode hides the tier bar on tap');
  else fail('Record Mode tier bar still visible');
  const recFrame = page.frames().find((f) => f.url() === 'about:srcdoc');
  const recorded = await recFrame
    ?.evaluate(() => document.documentElement.dataset.record)
    .catch(() => undefined);
  if (recorded === '9x16') ok('reader hides its own top bar in 9:16 Record Mode');
  else fail(`reader record flag: ${recorded}`);
  await page
    .frameLocator('iframe[title="Reader preview"]')
    .getByRole('button', { name: 'Silent' })
    .click({ timeout: 15000 });
  await page.waitForTimeout(800);
  const record = await page.screenshot();
  if (packAt) await composite(page, [studio, record], path('03-booktok-9x16-teaser-studio'));

  // 04 — Settings › Language › Español, then the Library in Spanish.
  await page.goto(`${WRITER}settings`);
  await tid('settings-language').waitFor({ timeout: 15000 });
  await tid('settings-language-es').click();
  await page.waitForTimeout(400);
  await tid('settings-language').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const settingsEs = await page.screenshot();
  const sOver = await overflowX(page);
  await page.goto(`${WRITER}`);
  await tid('novel-card-vertical-slice').waitFor({ timeout: 20000 });
  await page.waitForTimeout(400);
  const libraryEs = await page.screenshot();
  const lOver = await overflowX(page);
  if (await page.getByText('Biblioteca').first().isVisible())
    ok('Library switches to Español live');
  else fail('Library is not in Spanish');
  if (sOver <= 0 && lOver <= 0) ok('Spanish layout has zero horizontal overflow');
  else fail(`horizontal overflow: settings ${sOver}px, library ${lOver}px`);
  if (packAt) await composite(page, [settingsEs, libraryEs], path('04-settings-language-es'));
  await page.goto(`${WRITER}settings`);
  await tid('settings-language-system').click();
  await page.waitForTimeout(300);
}
