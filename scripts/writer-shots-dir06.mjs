// Directive 06 writer shots (phone, run last by writer-shots.mjs; pack root):
//   01 skippable 3-step Welcome micro-tour (fresh workspace),
//   02 offline Help & Legal center (6-module Gimmick Guide · shortcuts/backup · legal/licenses),
//   03 Chapter Editor with the Read-Aloud bar + @mention Story Bible popover | peek card,
//   04 Trash with danger-red Delete forever / Empty trash | Settings › Privacy & integrity
//      (Anonymous crash reports off by default + Help & Legal row).
const NS = 'kn-writer:';
const NOTE_ID = 'qa-bible-harbour';

/** Side-by-side composite of 390×844 @2× panels, rendered in a scratch tab. */
async function composite(page, panels, path) {
  const tab = await page.context().browser().newPage({ deviceScaleFactor: 2 });
  await tab.setViewportSize({ width: 390 * panels.length + 12 * (panels.length + 1), height: 868 });
  const imgs = panels.map((b) => `data:image/png;base64,${b.toString('base64')}`);
  await tab.setContent(
    `<body style="margin:0;padding:12px;display:flex;gap:12px;background:#0b0c10">${imgs
      .map((src) => `<img src="${src}" style="width:390px;height:844px">`)
      .join('')}</body>`,
  );
  await tab.waitForTimeout(200);
  await tab.screenshot({ path });
  await tab.close();
}

const bg = (loc) => loc.evaluate((el) => getComputedStyle(el).backgroundColor);
const fg = (loc) =>
  loc.evaluate((el) => getComputedStyle(el.querySelector('div[dir], div') ?? el).color);

export async function dir06Pass(page, { WRITER, packAt, tid, ok, fail, editor }) {
  const path = (name) => `${packAt}/${name}.png`;

  // 01 — A genuinely fresh workspace (own context: only the seeded demo novel) opens the tour.
  const fresh = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      hasTouch: true,
      colorScheme: 'dark',
    });
  const first = await fresh.newPage();
  const errs = [];
  first.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  first.on('pageerror', (e) => errs.push(String(e)));
  const ftid = (id) => first.getByTestId(id);
  await first.goto(WRITER);
  await ftid('welcome-tour').waitFor({ timeout: 20000 });
  if (await ftid('welcome-skip').isVisible())
    ok('Welcome tour opens on a fresh workspace (Skip visible)');
  else fail('Welcome tour Skip is not visible');
  if (await ftid('welcome-open-preview').isVisible()) ok('step 1 offers "Open Live Preview"');
  else fail('step 1 has no Open Live Preview CTA');
  await first.waitForTimeout(400);
  if (packAt) await first.screenshot({ path: path('01-onboarding-micro-tour') });
  await ftid('welcome-next').click();
  await ftid('welcome-next').click();
  const quick = ['welcome-new-novel', 'welcome-import', 'welcome-restore'];
  if ((await Promise.all(quick.map((q) => ftid(q).isVisible()))).every(Boolean))
    ok('step 3 offers New novel · Import · Restore backup');
  else fail('step 3 quick actions missing');
  await ftid('welcome-skip').click();
  await first.waitForTimeout(300);
  const stored = await first.evaluate((ns) => localStorage.getItem(`${ns}setting/onboarding`), NS);
  if (stored?.includes('dismissedAt')) ok('Skip persists setting/onboarding.dismissedAt');
  else fail(`onboarding not persisted: ${stored}`);
  await first.reload();
  await ftid('novel-card-vertical-slice').waitFor({ timeout: 20000 });
  await first.waitForTimeout(600);
  if ((await ftid('welcome-tour').count()) === 0) ok('dismissed tour never reopens');
  else fail('tour reopened after Skip');
  if (errs.length) fail(`fresh-workspace console errors: ${errs.join(' | ')}`);
  await fresh.close();

  // 02 — Settings › Help & Legal, the offline Help center.
  await page.goto(`${WRITER}settings`);
  await tid('card-privacy').waitFor({ timeout: 15000 });
  const crash = tid('settings-crash-reports');
  const crashOn = await crash.evaluate((el) => el.getAttribute('aria-checked'));
  if (crashOn === 'false') ok('Anonymous crash reports is off by default');
  else fail(`crash reports toggle default: ${crashOn}`);
  await tid('card-privacy').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const privacy = await page.screenshot();
  await tid('open-help').click();
  await tid('help-screen').waitFor({ timeout: 15000 });
  const modules = await page.locator('[data-testid^="help-module-"]').count();
  if (modules === 6) ok('Gimmick Guide lists all 6 registry modules');
  else fail(`Gimmick Guide lists ${modules} modules`);
  for (const id of ['help-open-shortcuts', 'help-replay-tour', 'help-licenses', 'help-open-doctor'])
    if ((await tid(id).count()) !== 1) fail(`Help is missing ${id}`);
  await page.waitForTimeout(300);
  const helpTop = await page.screenshot();
  await tid('help-licenses').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const helpBottom = await page.screenshot();
  if (packAt) await composite(page, [helpTop, helpBottom], path('02-help-legal-center'));
  await tid('help-licenses').click();
  if (await page.getByText('SIL Open Font License', { exact: false }).first().isVisible())
    ok('Licenses sheet lists SIL OFL 1.1 fonts offline');
  else fail('Licenses sheet has no SIL OFL notice');
  await page.getByRole('button', { name: 'Close sheet' }).last().click();

  // 03 — Chapter Editor: Read aloud bar + Story Bible popover, then the peek card.
  await page.evaluate(
    ([ns, id]) => {
      const now = Date.now();
      const data = {
        id,
        parentFolderId: null,
        title: 'Harbour District',
        blocks: [
          { id: 'qa-b1', kind: 'prose', text: 'Rain-slick quays, **neon** over the cranes.' },
        ],
        createdAt: now,
        updatedAt: now,
      };
      localStorage.setItem(`${ns}doc/${id}`, JSON.stringify({ data, updatedAt: now }));
    },
    [NS, NOTE_ID],
  );
  await editor();
  await tid('editor-menu').click();
  await tid('menu-read-aloud').click();
  await tid('read-aloud-bar').waitFor({ timeout: 10000 });
  ok('⋯ › Read aloud opens the Read-Aloud bar');
  await tid('editor-menu').click();
  await tid('menu-story-bible').click();
  await tid(`story-bible-item-${NOTE_ID}`).waitFor({ timeout: 10000 });
  ok('⋯ › Story Bible lists non-trashed Notes');
  await page.waitForTimeout(300);
  const qol = await page.screenshot();
  await tid(`story-bible-peek-${NOTE_ID}`).click();
  await tid('story-bible-open-note').waitFor({ timeout: 10000 });
  ok('Story Bible peek card opens with "Open full note"');
  await page.waitForTimeout(400);
  const peek = await page.screenshot();
  if (packAt) await composite(page, [qol, peek], path('03-editor-read-aloud-and-bible'));
  await page.getByRole('button', { name: 'Close sheet' }).last().click();
  await tid('read-aloud-close').click();
  await page.evaluate(([ns, id]) => localStorage.removeItem(`${ns}doc/${id}`), [NS, NOTE_ID]);

  // 04 — Trash: destructive actions in danger red, beside Settings › Privacy & integrity.
  await tid('editor-menu').click();
  await tid('menu-trash').click();
  await tid('dialog-confirm').click();
  await page.waitForURL(/\/novel\/vertical-slice$/, { timeout: 10000 });
  await page.goto(`${WRITER}trash`);
  await tid('trash-row-ch01').waitFor({ timeout: 10000 });
  const restoreBg = await bg(tid('trash-restore-ch01'));
  const deleteBg = await bg(tid('trash-delete-ch01'));
  const emptyBg = await bg(tid('trash-empty'));
  const deleteFg = await fg(tid('trash-delete-ch01'));
  const tinted = (c) => c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent';
  if (tinted(deleteBg) && deleteBg === emptyBg && deleteBg !== restoreBg)
    ok(`Delete forever + Empty trash use the danger surface (${deleteBg}, ink ${deleteFg})`);
  else fail(`Trash danger styling: delete ${deleteBg}, empty ${emptyBg}, restore ${restoreBg}`);
  await page.waitForTimeout(300);
  const trash = await page.screenshot();
  if (packAt) await composite(page, [trash, privacy], path('04-trash-danger-and-privacy-optin'));
  await tid('trash-restore-ch01').click();
  await tid('trash-row-ch01').waitFor({ state: 'detached', timeout: 10000 });
  ok('chapter restored after the Trash shot');
}
