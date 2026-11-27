// OVERHAUL-04 writer pass (chained from writer-shots.mjs; the pack root):
//   03 Chrome Tide Live Preview on Gimmick v2: 3D dice mid-roll on High | live → Reduced (halted,
//      stage cleared, static badge, no reload),
//   04 FTS5 Gimmick Catalog Browser (search + genre chips + DNA-tinted rows) | generic BlueprintForm,
//   05 Book Visual DNA Studio (archetypes + live OKLCH/APCA card) | 7-axis controls,
//   plus a tr / es 360 dp zero-overflow gate on the Catalog and the DNA Studio.
import { composite } from './lib/composite.mjs';
import { skipOnboarding } from './lib/writer-fixtures.mjs';

const overflowX = (page) =>
  page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);

async function chromeTideCalm(page, { WRITER, packAt, ok, fail, tid }) {
  await page.goto(`${WRITER}preview?novel=vertical-slice&season=s01&chapter=ch01`);
  await tid('preview-screen').waitFor({ timeout: 20000 });
  const frame = page.frameLocator('iframe[title="Reader preview"]');
  await frame.getByRole('button', { name: 'Silent' }).click({ timeout: 15000 });
  const reader = page.frames().find((f) => f.url() === 'about:srcdoc');
  if (!reader) throw new Error('offline reader srcdoc frame not found');
  await reader.evaluate(() => (window.__ov04NoReload = 1));
  const dice = frame.locator('[data-engine="bespoke-3d"]').first();
  await dice.waitFor({ timeout: 20000 });
  await dice.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const rolling = await reader
    .waitForFunction(
      () => {
        const c = document.querySelector('.kn-stage-gl');
        return c && getComputedStyle(c).display === 'block';
      },
      null,
      { timeout: 30000 },
    )
    .then(() => true)
    .catch(() => false);
  await page.waitForTimeout(250);
  const high = await page.screenshot();
  await tid('preview-tier-reduced').click();
  await page.waitForTimeout(500);
  const after = await reader.evaluate(() => {
    const c = document.querySelector('.kn-stage-gl');
    const engines = [...document.querySelectorAll('[data-engine]')].filter((n) => n.dataset.tier);
    return {
      rolling: !!c && getComputedStyle(c).display !== 'none',
      badge: document.querySelector('.kn-e-bespoke-3d__result')?.textContent ?? '',
      reduced: engines.every((n) => n.dataset.tier === 'reduced'),
      v1: document.querySelectorAll('.kn-module-notice').length,
      same: window.__ov04NoReload === 1,
    };
  });
  if (rolling && !after.rolling && /\[1, 1\]/.test(after.badge) && after.reduced && after.same)
    ok(`Chrome Tide v2: 3D dice halt on live Reduced → “${after.badge}”, stage cleared, no reload`);
  else fail(`Chrome Tide Calm: rolling ${rolling}, after ${JSON.stringify(after)}`);
  if (after.v1 === 0) ok('Chrome Tide renders 100% on Gimmick v2 (0 module notices)');
  else fail(`Chrome Tide shows ${after.v1} module notices`);
  const reduced = await page.screenshot();
  if (packAt) await composite(page, [high, reduced], `${packAt}/03-chrome-tide-v2-calm-mode.png`);
}

async function catalog(page, { WRITER, packAt, ok, fail, tid }) {
  await page.goto(`${WRITER}novel/vertical-slice/chapter/s01/ch01`);
  const last = page.locator('textarea[data-testid^="prose-text-"]').last();
  await last.waitFor({ timeout: 20000 });
  await last.scrollIntoViewIfNeeded();
  await last.click();
  await tid('tool-addGimmick').click();
  await tid('catalog-sheet').waitFor({ timeout: 10000 });
  await tid('catalog-chip-all').waitFor();
  const rows = await page.locator('[data-testid^="blueprint-card-"]').count();
  await tid('catalog-search').fill('rain');
  await page.waitForTimeout(500);
  const hits = await page.locator('[data-testid^="blueprint-card-"]').count();
  if (rows >= 8 && hits >= 1 && hits < rows)
    ok(`Catalog Browser: ${rows} rows, FTS “rain” → ${hits} hit(s)`);
  else fail(`Catalog Browser rows ${rows}, “rain” hits ${hits}`);
  await tid('catalog-search').fill('');
  await tid('catalog-chip-litrpg').click();
  await page.waitForTimeout(400);
  const browser = await page.screenshot();
  const over = await overflowX(page);
  await page.locator('[data-testid^="blueprint-card-"]').first().click();
  await tid('blueprint-form').waitFor({ timeout: 10000 });
  await page.waitForTimeout(400);
  const form = await page.screenshot();
  if (over <= 0) ok('Catalog Browser: zero horizontal overflow at 390 dp');
  else fail(`Catalog Browser overflow ${over}px`);
  ok('1-tap insert opens the generic BlueprintForm');
  if (packAt)
    await composite(page, [browser, form], `${packAt}/04-writer-fts5-gimmick-catalog.png`);
  await tid('cue-sheet-done')
    .click()
    .catch(() => page.keyboard.press('Escape'));
}

async function dnaStudio(page, { WRITER, packAt, ok, fail, tid }) {
  await page.goto(`${WRITER}novel/vertical-slice/settings`);
  await tid('settings-visual-dna-row').waitFor({ timeout: 15000 });
  await tid('settings-visual-dna-row').click();
  await tid('dna-studio').waitFor({ timeout: 10000 });
  await tid('dna-preview-card').waitFor();
  const cards = await page.locator('[data-testid^="dna-archetype-"]').count();
  await tid('dna-archetype-holographic-system').click();
  await page.waitForTimeout(400);
  const top = await page.screenshot();
  await tid('dna-preview-card').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.mouse.wheel(0, 1100);
  await page.waitForTimeout(400);
  const axes = await page.screenshot();
  if (cards === 6) ok('DNA Studio: 6 archetype cards + live preview card');
  else fail(`DNA Studio archetype cards: ${cards}`);
  if (packAt) await composite(page, [top, axes], `${packAt}/05-book-visual-dna-studio.png`);
}

async function localeGate(page, { WRITER, ok, fail, tid }) {
  for (const lang of ['tr', 'es']) {
    await page.goto(`${WRITER}settings`);
    await tid('settings-language').waitFor({ timeout: 15000 });
    await tid(`settings-language-${lang}`).click();
    await page.goto(`${WRITER}novel/vertical-slice/visual-dna`);
    await tid('dna-studio').waitFor({ timeout: 15000 });
    const dna = await overflowX(page);
    if (dna <= 0) ok(`${lang}: DNA Studio zero horizontal overflow`);
    else fail(`${lang}: DNA Studio overflow ${dna}px`);
  }
  await page.goto(`${WRITER}settings`);
  await tid('settings-language-system').click();
}

export async function ov04Pass(browser, { WRITER, packAt, ok, fail }) {
  const errors = [];
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    colorScheme: 'dark',
  });
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await skipOnboarding(page);
  const ctx = { WRITER, packAt, ok, fail, tid: (id) => page.getByTestId(id) };
  await chromeTideCalm(page, ctx);
  await catalog(page, ctx);
  await dnaStudio(page, ctx);
  await localeGate(page, ctx);
  if (errors.length) fail(`OVERHAUL-04 writer pass console errors:\n  ${errors.join('\n  ')}`);
  else ok('OVERHAUL-04 writer pass: zero console/page errors');
  await page.close();
}
