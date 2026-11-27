// OVERHAUL-03 Gimmick v2 smoke (chained from smoke.mjs): the 7 engines × high/lite/reduced × 20
// leak runs, live kn:tier-change without reload, keyboard reveal, contact sheets with overflow
// checks (QA shots 01-03; 04 comes from writer-shots-ov03.mjs) and the v1 lighter arm regression.

const ENGINES = {
  'frame-hud': 'system-notification',
  'chat-thread': 'cyberbrain-link',
  'text-alchemy': 'gaslight-rewrite',
  'artifact-doc': 'police-dossier',
  'tactile-reveal': 'wax-seal-letter',
  'telemetry-meter': 'ekg-vitals',
  'kinetic-prose': 'typewriter-echo',
};
const v2 = (BASE, id, tier) => `${BASE}sandbox/?blueprint=${id}&tier=${tier}&dna=noir-rain`;

async function leakRuns(page, BASE, { ok, fail }) {
  const stats = page.locator('.sb-stats');
  const rows = [];
  for (const [engine, id] of Object.entries(ENGINES)) {
    for (const tier of ['high', 'lite', 'reduced']) {
      await page.goto(v2(BASE, id, tier));
      await page.locator(`[data-engine="${engine}"]`).waitFor({ timeout: 10000 });
      await page.getByRole('button', { name: '×20' }).click();
      await stats.filter({ hasText: /leak/i }).waitFor({ timeout: 240000 });
      const after = ((await stats.textContent()) ?? '').split('\n')[0];
      const left = await page.evaluate(
        (e) => ({
          styles: document.querySelectorAll(`style[data-kn-engine="${e}"]`).length,
          nodes: document.querySelectorAll('[data-block="sandbox"] *').length,
        }),
        engine,
      );
      const clean = after.includes('No leaks') && left.styles <= 1 && left.nodes === 0;
      rows.push(`${engine}/${tier}: ${clean ? '0 leaks' : 'LEAK'}`);
      if (!clean)
        fail(`${id} ×20 on ${tier}: ${after} · styles ${left.styles} · nodes ${left.nodes}`);
    }
  }
  ok(`v2 engines ×20 × 3 tiers: ${rows.filter((r) => r.endsWith('0 leaks')).length}/21 clean`);
  console.log(`  ${rows.join('\n  ')}`);
}

async function liveTier(page, BASE, { ok, fail }) {
  // Chat thread mid-beat → Calm: every line appears at once, tier flips, document never reloads.
  await page.goto(v2(BASE, 'cyberbrain-link', 'high'));
  await page.evaluate(() => (window.__noReload = 1));
  await page.getByRole('button', { name: 'Trigger Beat' }).click();
  await page.waitForTimeout(400);
  const before = await page.locator('li[data-pending]').count();
  await page.locator('.sb-calm').click();
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({
    pending: document.querySelectorAll('li[data-pending]').length,
    tier: document.querySelector('[data-engine="chat-thread"]')?.dataset.tier,
    same: window.__noReload === 1,
  }));
  if (before > 0 && after.pending === 0 && after.tier === 'reduced' && after.same)
    ok(`live kn:tier-change: chat-thread ${before} pending → 0, tier reduced, no reload`);
  else fail(`live tier change: before ${before}, after ${JSON.stringify(after)}`);
  // Meter raf loop stops on downgrade (runtime resources drop to the idle count).
  await page.goto(v2(BASE, 'ekg-vitals', 'high'));
  await page.getByRole('button', { name: 'Trigger Beat' }).click();
  await page.waitForTimeout(1500);
  await page.locator('.kn-chip', { hasText: 'Reduced' }).click();
  await page.waitForTimeout(1200);
  const tier = await page.locator('[data-engine="telemetry-meter"]').getAttribute('data-tier');
  const line = (await page.locator('.sb-stats').textContent()) ?? '';
  if (tier === 'reduced' && /runtime 0/.test(line))
    ok('live kn:tier-change: telemetry raf loop cancelled (runtime 0)');
  else fail(`telemetry downgrade: tier ${tier}, stats “${line}”`);
}

async function keyboardReveal(page, BASE, { ok, fail }) {
  for (const id of ['wax-seal-letter', 'biometric-lock']) {
    await page.goto(v2(BASE, id, 'high'));
    const btn = page.locator('[data-engine="tactile-reveal"] button[aria-expanded]').first();
    await btn.waitFor({ timeout: 10000 });
    await btn.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(900);
    const expanded = await btn.getAttribute('aria-expanded');
    if (expanded === 'true') ok(`${id}: Enter reveals (aria-expanded=true)`);
    else fail(`${id}: Enter did not reveal (aria-expanded=${expanded})`);
  }
}

/** Every card must fit its 360 px cell: no horizontal overflow, nothing clipped on the right. */
async function overflow(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-sheet-slot]')].flatMap((slot) => {
      const cell = slot.parentElement.getBoundingClientRect();
      const bad = [...slot.querySelectorAll('*')].some((n) => {
        const r = n.getBoundingClientRect();
        // Children of an <svg> are clipped by it (e.g. the scrolling EKG): measure the svg box only.
        if (n instanceof SVGElement && n.ownerSVGElement) return false;
        return r.width > 0 && r.right > cell.right + 1 && !n.classList.contains('kn-e-orn');
      });
      return bad || slot.scrollWidth > slot.clientWidth + 1 ? [slot.dataset.sheetSlot] : [];
    }),
  );
}

async function sheets(newPage, BASE, { ok, fail, shotsAt }) {
  const page = await newPage(2);
  await page.setViewportSize({ width: 1542, height: 1000 });
  const shots = [
    ['batch1', 'dark', '01-engines-batch1-dark-sheet'],
    ['batch1', 'light', '02-engines-batch1-light-sheet'],
    ['dna', 'dark', '03-visual-dna-same-blueprint-4-books'],
  ];
  for (const [sheet, theme, name] of shots) {
    await page.goto(`${BASE}sandbox/?sheet=${sheet}&theme=${theme}&tier=high`);
    await page.locator('body[data-ready]').waitFor({ timeout: 30000 });
    await page.waitForTimeout(1200);
    const cards = await page
      .locator('[data-sheet-slot] .kn-e, [data-sheet-slot] [data-engine]')
      .count();
    const bad = await overflow(page);
    if (bad.length) fail(`${name}: overflow/clipping in ${bad.join(', ')}`);
    else ok(`${name}: ${cards} cards, 0 overflow at 360 px`);
    if (shotsAt) await page.screenshot({ path: `${shotsAt}/${name}.png`, fullPage: true });
  }
  await page.close();
}

async function lighter(page, BASE, { ok, fail }) {
  await page.goto(`${BASE}sandbox/?module=bl-lighter-flick&tier=high`);
  const trigger = page.getByRole('button', { name: 'Trigger Beat' });
  await trigger.waitFor();
  await page.waitForTimeout(600);
  await trigger.click();
  const flame = page.locator('.kn-lighter');
  await flame.and(page.locator('[data-kn-lighter="lit"]')).waitFor({ timeout: 5000 });
  if (await flame.locator('canvas').count()) ok('bl-lighter-flick (v1 arm) ignites on High');
  else fail('bl-lighter-flick High tier has no canvas flame');
  // Lifecycle: a short burn auto-extinguishes and the overlay empties.
  await page
    .locator('.sb-field', { has: page.locator('.sb-label', { hasText: 'Burns for' }) })
    .locator('input[type="range"]')
    .evaluate((el) => {
      el.value = '1500';
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  await page.waitForTimeout(300);
  await trigger.click();
  await flame.and(page.locator('[data-kn-lighter="lit"]')).waitFor({ timeout: 5000 });
  const lit = Date.now();
  const out = await flame
    .waitFor({ state: 'detached', timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (out) ok(`bl-lighter-flick ignite → extinguish lifecycle (${Date.now() - lit} ms)`);
  else fail('bl-lighter-flick never went out after a 1.5 s burn');
  const stats = page.locator('.sb-stats');
  await page.getByRole('button', { name: '×20' }).click();
  await stats.filter({ hasText: /leak/i }).waitFor({ timeout: 240000 });
  const after = (await stats.textContent()) ?? '';
  if (after.includes('No leaks')) ok('bl-lighter-flick ×20: No leaks');
  else fail(`bl-lighter-flick ×20: ${after.split('\n')[0]}`);
}

export async function v2Pass(newPage, BASE, ctx) {
  const page = await newPage(1);
  await liveTier(page, BASE, ctx);
  await keyboardReveal(page, BASE, ctx);
  await leakRuns(page, BASE, ctx);
  await lighter(page, BASE, ctx);
  await page.close();
  await sheets(newPage, BASE, ctx);
}
