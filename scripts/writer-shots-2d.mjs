// Directive 02D shot pack + gates: offline live preview (no server), collapsible toolbar halves,
// App Settings (preview mode + haptics) and the Book Compiler .knbook tile. Called from
// writer-shots.mjs.
import { composite } from './writer-shots-workspace.mjs';

/** Runs right after the live preview has rendered the unsaved draft in the srcdoc iframe. */
export async function offlinePreviewShot(page, ctx) {
  const { frame, reader, tid, shot, ok, fail, blocked, RICH } = ctx;
  const edited = await frame
    .locator('strong', { hasText: 'Snake eyes.' })
    .first()
    .isVisible()
    .catch(() => false);
  const plain = RICH.replace(/\*\*|\*|\+\+|~~|==/g, '');
  const text = (await reader.evaluate(() => document.body.textContent)) ?? '';
  if (edited && text.includes(plain.slice(0, 40)))
    ok('offline preview renders the edited, unsaved line inside the srcdoc reader');
  else fail('edited line missing from the offline srcdoc reader');
  const note = (await tid('preview-mode-note').textContent()) ?? '';
  if (/^Live · Built-in offline reader · /.test(note.trim())) ok(`preview caption: ${note.trim()}`);
  else fail(`preview caption is not "Built-in offline reader": ${note}`);
  if (blocked.length) fail(`offline preview tried the network: ${blocked.slice(0, 3).join(', ')}`);
  else ok('offline preview made zero external requests (reader server never started)');
  await page.waitForTimeout(300);
  await shot('03-offline-live-preview-no-server');
}

/** Collapse each toolbar half, check persistence across a reload, then restore both. */
export async function toolbarPass(page, { tid, editor, shotsAt, ok, fail }) {
  await editor();
  const visible = async (id) => tid(id).isVisible();
  const state = async () => ({
    formatCollapsed: await visible('toolbar-expand-format'),
    addCollapsed: await visible('toolbar-expand-add'),
  });
  const settle = () => page.waitForTimeout(450);
  if ((await visible('toolbar-expand-format')) || (await visible('toolbar-expand-add')))
    return fail('toolbar starts collapsed (expected both halves expanded)');

  await tid('toolbar-collapse-add').click();
  await tid('toolbar-expand-add').waitFor({ timeout: 3000 });
  await settle();
  const addCollapsed = await page.screenshot();
  await tid('toolbar-expand-add').click();
  await tid('toolbar-collapse-add').waitFor({ timeout: 3000 });

  await tid('toolbar-collapse-format').click();
  await tid('toolbar-expand-format').waitFor({ timeout: 3000 });
  await settle();
  const formatCollapsed = await page.screenshot();
  await composite(page, shotsAt, '02-toolbar-halves-collapsed', [addCollapsed, formatCollapsed]);

  await tid('toolbar-collapse-add').click();
  await tid('toolbar-expand-add').waitFor({ timeout: 3000 });
  await settle();
  await editor();
  const after = await state();
  if (after.formatCollapsed && after.addCollapsed)
    ok('both toolbar halves stay collapsed after reload');
  else fail(`toolbar collapse not persisted: ${JSON.stringify(after)}`);

  await tid('toolbar-expand-format').click();
  await tid('toolbar-expand-add').click();
  await tid('toolbar-collapse-format').waitFor({ timeout: 3000 });
  await tid('toolbar-collapse-add').waitFor({ timeout: 3000 });
  await settle();
  ok('toolbar halves collapse, persist across reload and restore');
}

/** 04 App Settings (preview selector + haptics) and 05 compiler export grid (.knbook tile). */
export async function settingsAndCompilerShots(page, { WRITER, tid, shotsAt, ok, fail }) {
  const shot = (name) => shotsAt && page.screenshot({ path: `${shotsAt}/${name}.png` });
  await page.goto(`${WRITER}settings`);
  await tid('settings-preview-mode').waitFor({ timeout: 15000 });
  await tid('settings-haptics').waitFor();
  // Scroll so the "Live preview" section label sits just under the top bar.
  await tid('settings-preview-mode').evaluate((el) => {
    el.scrollIntoView({ block: 'start' });
    let s = el.parentElement;
    while (s && s.scrollHeight <= s.clientHeight) s = s.parentElement;
    s?.scrollBy(0, -170);
  });
  await page.waitForTimeout(300);
  const box = await tid('settings-haptics-test').boundingBox();
  if (box && box.y + box.height <= 844) {
    await shot('04-settings-offline-and-haptics');
  } else {
    const top = await page.screenshot();
    await tid('settings-haptics-test').evaluate((el) => el.scrollIntoView({ block: 'end' }));
    await page.waitForTimeout(300);
    await composite(page, shotsAt, '04-settings-offline-and-haptics', [
      top,
      await page.screenshot(),
    ]);
  }
  ok('App Settings shows the Live preview selector, Haptics toggle and Test vibration');

  await page.goto(`${WRITER}novel/vertical-slice/compile`);
  await tid('export-knbook').waitFor({ timeout: 10000 });
  await tid('export-knbook').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const hint = tid('export-knbook').getByText('Portable book archive');
  if (!(await hint.count())) fail('.knbook tile does not say "Portable book archive"');
  else {
    const clipped = await hint.first().evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    if (clipped) fail('.knbook subtitle is truncated');
    else ok('.knbook subtitle "Portable book archive" renders untruncated');
  }
  await shot('05-compiler-knbook-fixed');
}
