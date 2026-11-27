// OVERHAUL-04 engine smoke (chained from smoke.mjs): all 14 v2 engines × high/lite/reduced × 20
// leak runs, and live kn:tier-change → Calm proofs (no reload) for chat-thread, telemetry,
// bespoke-3d (3D dice halt + stage cleared), particle-field, screen-fx and audio-bed.

export const ENGINES = {
  'frame-hud': 'system-notification',
  'chat-thread': 'cyberbrain-link',
  'text-alchemy': 'gaslight-rewrite',
  'artifact-doc': 'police-dossier',
  'tactile-reveal': 'wax-seal-letter',
  'telemetry-meter': 'ekg-vitals',
  'kinetic-prose': 'typewriter-echo',
  'margin-note': 'lore-footnote',
  'spatial-layout': 'dual-pov-split',
  'screen-fx': 'frost-creep-chill',
  'particle-field': 'ember-storm',
  'audio-bed': 'rain-on-tin',
  'audio-stinger': 'level-up-chord',
  'bespoke-3d': 'dice-throw-3d',
};
export const v2 = (BASE, id, tier, dna = 'noir-rain') =>
  `${BASE}sandbox/?blueprint=${id}&tier=${tier}&dna=${dna}`;

const statsText = (page) =>
  page
    .locator('.sb-stats')
    .textContent()
    .then((t) => t ?? '');

async function leakRuns(page, BASE, { ok, fail }) {
  const stats = page.locator('.sb-stats');
  const rows = [];
  for (const [engine, id] of Object.entries(ENGINES)) {
    for (const tier of ['high', 'lite', 'reduced']) {
      await page.goto(v2(BASE, id, tier));
      await page.locator(`[data-engine="${engine}"]`).waitFor({ timeout: 10000 });
      await page.getByRole('button', { name: '×20' }).click();
      await stats.filter({ hasText: /leak/i }).waitFor({ timeout: 400000 });
      const after = (await statsText(page)).split('\n')[0];
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
      if (engine === 'bespoke-3d' && tier === 'high') {
        const gl = /new GL contexts (\d+)/.exec(after)?.[1];
        if (gl === '1' || gl === '0')
          ok(`bespoke-3d ×20 High: one shared WebGL context (${after})`);
        else fail(`bespoke-3d ×20 High made ${gl} WebGL contexts`);
      }
    }
  }
  const n = Object.keys(ENGINES).length * 3;
  ok(`v2 engines ×20 × 3 tiers: ${rows.filter((r) => r.endsWith('0 leaks')).length}/${n} clean`);
  console.log(`  ${rows.join('\n  ')}`);
}

/** Triggers on High, waits for `busy`, flips Calm, then checks `calmed` (both run in the page). */
async function calmProof(page, BASE, id, busy, calmed, { ok, fail }, label) {
  await page.goto(v2(BASE, id, 'high'));
  await page.evaluate(() => (window.__noReload = 1));
  await page.getByRole('button', { name: 'Trigger Beat' }).click();
  const before = await page
    .waitForFunction(busy, null, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  await page.locator('.sb-calm').click();
  await page.waitForTimeout(400);
  const after = await page.evaluate(calmed);
  const same = await page.evaluate(() => window.__noReload === 1);
  await page.waitForTimeout(1200); // stats line refreshes once a second
  const line = await statsText(page);
  if (before && after === true && same && /runtime 0/.test(line))
    ok(`live Calm: ${label} (runtime 0, no reload)`);
  else
    fail(
      `live Calm ${id}: busy ${before}, calmed ${JSON.stringify(after)}, reload-free ${same}, “${line.split('\n').at(-1)}”`,
    );
}

async function liveTier(page, BASE, ctx) {
  await calmProof(
    page,
    BASE,
    'cyberbrain-link',
    () => document.querySelectorAll('li[data-pending]').length > 0,
    () =>
      document.querySelectorAll('li[data-pending]').length === 0 &&
      document.querySelector('[data-engine="chat-thread"]')?.dataset.tier === 'reduced',
    ctx,
    'chat-thread pending lines land at once',
  );
  await calmProof(
    page,
    BASE,
    'ekg-vitals',
    () => true,
    () => document.querySelector('[data-engine="telemetry-meter"]')?.dataset.tier === 'reduced',
    ctx,
    'telemetry raf loop cancelled',
  );
  await calmProof(
    page,
    BASE,
    'dice-throw-3d',
    () =>
      getComputedStyle(document.querySelector('.kn-stage-gl') ?? document.body).display ===
        'block' && document.querySelector('.kn-stage-gl') !== null,
    () => {
      const c = document.querySelector('.kn-stage-gl');
      const done = document.querySelector('[data-engine="bespoke-3d"]')?.dataset.state === 'done';
      const text = document.querySelector('.kn-e-bespoke-3d__result')?.textContent ?? '';
      const s = window.__knWebglStage?.();
      return (!c || getComputedStyle(c).display === 'none') &&
        done &&
        /\[1, 1\]/.test(text) &&
        s?.leases === 0 &&
        s?.geometries === 0
        ? true
        : { display: c && getComputedStyle(c).display, done, text, s };
    },
    ctx,
    'bespoke-3d dice halt, stage canvas hidden + cleared, static “[1, 1]” badge',
  );
  await calmProof(
    page,
    BASE,
    'ember-storm',
    () => !!document.querySelector('[data-engine="particle-field"] canvas'),
    () => document.querySelector('[data-engine="particle-field"]')?.dataset.tier === 'reduced',
    ctx,
    'particle-field raf stopped, static divider',
  );
  await calmProof(
    page,
    BASE,
    'frost-creep-chill',
    () => document.body.querySelectorAll(':scope > [class*="screen-fx"]').length > 0,
    () => document.body.querySelectorAll(':scope > [class*="screen-fx"]').length === 0,
    ctx,
    'screen-fx fixed overlay removed',
  );
  await calmProof(
    page,
    BASE,
    'rain-on-tin',
    () => /runtime [1-9]/.test(document.querySelector('.sb-stats')?.textContent ?? ''),
    () => document.querySelector('[data-engine="audio-bed"]')?.dataset.tier === 'reduced',
    ctx,
    'audio-bed graph ramped to 0 and disconnected',
  );
}

async function keyboardReveal(page, BASE, { ok, fail }) {
  for (const id of ['wax-seal-letter', 'biometric-lock', 'lore-footnote']) {
    await page.goto(v2(BASE, id, 'high'));
    const btn = page.locator('[data-block="sandbox"] button[aria-expanded]').first();
    await btn.waitFor({ timeout: 10000 });
    await btn.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(900);
    const expanded = await btn.getAttribute('aria-expanded');
    if (expanded === 'true') ok(`${id}: Enter reveals (aria-expanded=true)`);
    else fail(`${id}: Enter did not reveal (aria-expanded=${expanded})`);
  }
}

export async function enginesPass(newPage, BASE, ctx) {
  const page = await newPage(1);
  await liveTier(page, BASE, ctx);
  await keyboardReveal(page, BASE, ctx);
  await leakRuns(page, BASE, ctx);
  await page.close();
}
