// OVERHAUL-03 writer pass (chained from writer-shots.mjs): Writer Live Preview renders Chrome Tide
// with its Noir Rain Visual DNA through the v2 engines, then the tier bar switches to Reduced and
// the engines downgrade LIVE (the reader document is never reloaded). Composes
// 04-calm-mode-and-writer-preview.png: [preview on High | same preview after live → Reduced].
import { composite } from './lib/composite.mjs';
import { skipOnboarding } from './lib/writer-fixtures.mjs';

export async function ov03Pass(browser, { WRITER, packAt, ok, fail }) {
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
  const tid = (id) => page.getByTestId(id);
  await page.goto(`${WRITER}preview?novel=vertical-slice&season=s01&chapter=ch01`);
  await tid('preview-screen').waitFor({ timeout: 20000 });
  const frame = page.frameLocator('iframe[title="Reader preview"]');
  await frame.getByRole('button', { name: 'Silent' }).click({ timeout: 15000 });
  const chat = frame.locator('[data-engine="chat-thread"]');
  await chat.waitFor({ timeout: 20000 });
  await chat.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const reader = page.frames().find((f) => f.url() === 'about:srcdoc');
  if (!reader) throw new Error('offline reader srcdoc frame not found');
  await reader.evaluate(() => (window.__ov03NoReload = 1));
  const dna = await reader.evaluate(() => ({
    accent: getComputedStyle(document.querySelector('.kn-main')).getPropertyValue('--dna-accent'),
    font: getComputedStyle(document.querySelector('.kn-main')).getPropertyValue(
      '--dna-font-display',
    ),
  }));
  if (dna.accent && /Condensed/.test(dna.font))
    ok(`Live Preview applies Chrome Tide's Noir Rain DNA (accent ${dna.accent.trim()})`);
  else fail(`Live Preview DNA tokens missing: ${JSON.stringify(dna)}`);
  await page.waitForTimeout(1800);
  const high = await page.screenshot();

  await tid('preview-tier-reduced').click();
  await page.waitForTimeout(500);
  const after = await reader.evaluate(() => {
    const engines = [...document.querySelectorAll('[data-engine]')].filter((n) => n.dataset.tier);
    return {
      n: engines.length,
      reduced: engines.filter((n) => n.dataset.tier === 'reduced').length,
      pending: document.querySelectorAll('[data-engine="chat-thread"] li[data-pending]').length,
      same: window.__ov03NoReload === 1,
    };
  });
  if (after.n > 0 && after.reduced === after.n && after.pending === 0 && after.same)
    ok(`writer tier → Reduced: ${after.n}/${after.n} v2 engines downgraded live, no reload`);
  else fail(`writer live tier switch: ${JSON.stringify(after)}`);
  await page.waitForTimeout(300);
  const reduced = await page.screenshot();
  if (packAt)
    await composite(page, [high, reduced], `${packAt}/04-calm-mode-and-writer-preview.png`);
  if (errors.length) fail(`OVERHAUL-03 writer pass console errors:\n  ${errors.join('\n  ')}`);
  else ok('OVERHAUL-03 writer pass: zero console/page errors');
  await page.close();
}
