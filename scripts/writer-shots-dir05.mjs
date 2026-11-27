// Directive 05 writer shots (run last by writer-shots.mjs; pack root):
//   01 Book Compiler with the EPUB 3 card (and a real .epub download, OCF-checked),
//   02 Settings → Backup & Restore (freshness badge, external folder row, transfer note, Trash),
//   03 Trash screen with a soft-deleted chapter ("Deletes in 30 days", Restore, Delete forever).
import { readFileSync } from 'node:fs';

const MIME = 'application/epub+zip';

export async function dir05Pass(page, { WRITER, packAt, tid, ok, fail, editor }) {
  const shot = (name) => packAt && page.screenshot({ path: `${packAt}/${name}.png` });

  // 01 — EPUB 3 export card, then a real export through the browser download path.
  await page.goto(`${WRITER}novel/vertical-slice/compile`);
  const card = tid('export-epub');
  await card.waitFor({ timeout: 15000 });
  await card.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  if ((await card.textContent())?.includes('EPUB 3')) ok('Book Compiler lists the EPUB 3 card');
  else fail('EPUB 3 card text missing');
  await shot('01-compiler-epub-option');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    card.click(),
  ]);
  const bytes = readFileSync(await download.path());
  const ocf =
    download.suggestedFilename().endsWith('.epub') &&
    bytes.readUInt32LE(0) === 0x04034b50 &&
    bytes.readUInt16LE(8) === 0 &&
    bytes.readUInt16LE(28) === 0 &&
    bytes.subarray(30, 38).toString() === 'mimetype' &&
    bytes.subarray(38, 58).toString() === MIME;
  if (ocf) ok(`EPUB export downloads ${download.suggestedFilename()} (OCF mimetype at offset 0)`);
  else fail(`EPUB download not OCF-valid: ${download.suggestedFilename()}`);

  // Move chapter ch01 to Trash from the chapter editor's ⋯ menu.
  await editor();
  await tid('editor-menu').click();
  await tid('menu-trash').click();
  await tid('dialog-confirm').click();
  await page.waitForURL(/\/novel\/vertical-slice$/, { timeout: 10000 });
  if ((await tid('outline-chapter-ch01').count()) === 0) ok('trashed chapter left the outline');
  else fail('trashed chapter still listed in the outline');

  // 02 — Settings root (Data & Backup hub: Trash count) → Backups & External Folder (1 tap).
  await page.goto(`${WRITER}settings`);
  await tid('open-trash').waitFor({ timeout: 15000 });
  const trashRow = (await tid('open-trash').textContent()) ?? '';
  await tid('open-backup').click();
  const backup = tid('card-backup');
  await backup.waitFor({ timeout: 15000 });
  await tid('backup-freshness').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(400);
  const fresh = (await tid('backup-freshness').textContent()) ?? '';
  const parts = [
    /Not backed up yet|Backed up/.test(fresh),
    (await tid('backup-external-folder').textContent())?.includes('survives uninstall'),
    (await tid('backup-transfer-note').textContent())?.includes('Device transfer excludes'),
    trashRow.includes('Trash · 1 item'),
  ];
  if (parts.every(Boolean))
    ok(`Backup & Restore: "${fresh}", external folder, note, "${trashRow}"`);
  else fail(`Backup & Restore card incomplete: ${JSON.stringify(parts)} ${trashRow}`);
  await shot('02-settings-saf-backup-card');

  // 03 — Trash screen (back to the Settings root, then the Data & Backup hub's Trash row).
  await page.goto(`${WRITER}settings`);
  await tid('open-trash').click();
  await tid('trash-row-ch01').waitFor({ timeout: 10000 });
  const days = await tid('trash-days-ch01').textContent();
  if (days === 'Deletes in 30 days') ok('Trash lists the chapter: "Deletes in 30 days"');
  else fail(`Trash countdown: ${days}`);
  await page.waitForTimeout(300);
  await shot('03-trash-screen-restore');

  // Restore brings it back into the outline at its old place.
  await tid('trash-restore-ch01').click();
  await tid('trash-row-ch01').waitFor({ state: 'detached', timeout: 10000 });
  await page.goto(`${WRITER}novel/vertical-slice`);
  await tid('outline-chapter-ch01').waitFor({ timeout: 10000 });
  ok('Restore puts the chapter back in the outline');
}
