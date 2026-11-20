// Directive 02B-2 shot pack: Notes (nested folders + Recent), instant Search, Version History
// diff, Book Compiler, Master Lock keypad + Document Doctor. Called from writer-shots.mjs.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const NS = 'kn-writer:';
const chapter = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../sample-novels/vertical-slice/seasons/s01/ch01.json'),
    'utf8',
  ),
);

/** QA fixture: a small nested Notes tree, item meta, and two chapter checkpoints. */
function seed(now) {
  const rec = (data, updatedAt = now) => JSON.stringify({ data, updatedAt });
  const prose = (id, text) => ({ id, kind: 'prose', text });
  const folder = (id, title, parentFolderId, ago) => ({
    [`folder/${id}`]: rec({
      id,
      parentFolderId,
      title,
      createdAt: now - ago,
      updatedAt: now - ago,
    }),
  });
  const doc = (id, title, parentFolderId, blocks, ago) => ({
    [`doc/${id}`]: rec({
      id,
      parentFolderId,
      title,
      blocks,
      createdAt: now - ago,
      updatedAt: now - ago,
    }),
  });
  const older = chapter.blocks
    .filter((b) => !b.text?.startsWith('Boxcars'))
    .map((b) =>
      b.kind === 'prose' && b.text.startsWith('The rain')
        ? {
            ...b,
            text: 'It had rained on the harbour all week, and nobody in the Lantern Room cared.',
          }
        : b,
    );
  const snap = (id, ts, kind, blocks, label) => ({
    id,
    ts,
    kind,
    ...(label ? { label } : {}),
    wordCount: blocks.reduce((n, b) => n + (b.text ? b.text.split(/\s+/).length : 0), 0),
    blocks,
  });
  return {
    ...folder('f-world', 'Worldbuilding', null, 3 * 86400e3),
    ...folder('f-harbour', 'Harbour', 'f-world', 2 * 86400e3),
    ...folder('f-docks', 'Docks & Piers', 'f-harbour', 86400e3),
    ...folder('f-chars', 'Characters', null, 5 * 86400e3),
    ...folder('f-research', 'Research', null, 9 * 86400e3),
    ...doc(
      'd-fog',
      'Fog over Pier 9',
      null,
      [
        prose(
          '01M7WD7TGA0000000000000001',
          'The harbour fog smells of diesel and rain; Mara counts the lanterns twice.',
        ),
      ],
      60e3,
    ),
    ...doc(
      'd-dealer',
      'The Dealer',
      'f-chars',
      [prose('01M7WD7TGA0000000000000002', 'Never blinks. Rolls first.')],
      7200e3,
    ),
    ...doc(
      'd-tides',
      'Tide table, Roanapur',
      'f-harbour',
      [
        prose(
          '01M7WD7TGA0000000000000003',
          'Low tide at 04:12 leaves the harbour mud bare under Pier 9.',
        ),
      ],
      3 * 3600e3,
    ),
    ...doc(
      'd-ledger',
      'Lantern Room ledger',
      null,
      [prose('01M7WD7TGA0000000000000004', 'Debts owed.')],
      26 * 3600e3,
    ),
    'meta/item/f-world': rec({ tags: ['setting'], color: '#2f7d74', pinned: true }),
    'meta/item/f-chars': rec({ tags: ['cast'], color: '#7a5bb0' }),
    'meta/item/f-research': rec({ tags: [], color: '#c68a2e' }),
    'meta/item/d-fog': rec({ tags: ['scene', 'harbour'], color: '#3d6fb4', pinned: true }),
    'meta/item/d-ledger': rec({ tags: ['private'], locked: true, color: '#c0563b' }),
    'versions/chapter:ch01': rec({
      snapshots: [
        snap('01M7WD7TGB0000000000000002', now - 40 * 60e3, 'auto', older),
        snap(
          '01M7WD7TGB0000000000000001',
          now - 26 * 3600e3,
          'manual',
          older.slice(0, 6),
          'First draft',
        ),
      ],
    }),
  };
}

export async function workspacePass(page, { WRITER, shotsAt, tid, ok, fail, editor }) {
  const shot = (name) => shotsAt && page.screenshot({ path: `${shotsAt}/${name}.png` });
  const entries = Object.entries(seed(Date.now())).map(([k, v]) => [NS + k, v]);
  await page.evaluate((list) => {
    for (const [k, v] of list) localStorage.setItem(k, v);
  }, entries);

  // 01 Notes: nested folders, Recent strip, rails, pin/tag cues, sort, 3-tab bar.
  await page.goto(`${WRITER}folders`);
  await tid('folder-row-f-world').waitFor({ timeout: 20000 });
  await tid('tab-bar').waitFor();
  await tid('notes-sort').waitFor();
  if (await tid('recent-strip').count())
    ok('Notes shows the Recent strip, sort control and tab bar');
  else fail('Recent strip missing on Notes');
  await tid('folder-open-f-world').click();
  await tid('folder-row-f-harbour').waitFor();
  await tid('breadcrumbs').waitFor();
  ok('sub-folders open with a breadcrumb trail');
  await tid('tab-notes').click();
  await tid('folder-row-f-chars').waitFor();
  await page.waitForTimeout(400);
  await shot('01-folio-folders-recent');

  // 02 Search across a chapter and a note.
  await tid('tab-search').click();
  await tid('search-field').fill('harbour');
  await tid('search-result-0').waitFor({ timeout: 5000 });
  const text = await page.locator('[data-testid^="search-result-"]').allTextContents();
  const joined = text.join(' | ');
  if (/Snake Eyes/.test(joined) && /Fog over Pier 9/.test(joined))
    ok(`search matches a chapter and a note (${text.length} results)`);
  else fail(`search results missing chapter or note: ${joined.slice(0, 200)}`);
  if (/Debts owed/.test(joined)) fail('locked note body leaked into search');
  await page.waitForTimeout(300);
  await shot('02-folio-instant-search');
  await page.locator('[data-testid^="search-result-"]', { hasText: 'Snake Eyes' }).click();
  await tid('editor-top-bar').waitFor({ timeout: 10000 });
  ok('search result deep-links into the editor');

  // 03 Version History with the Myers diff.
  await editor();
  await tid('editor-menu').click();
  await tid('menu-versions').click();
  await tid('version-sheet').waitFor();
  await tid('version-row-0').click();
  await tid('version-diff').first().waitFor();
  ok('version history lists checkpoints and renders a diff');
  await page.waitForTimeout(400);
  await shot('03-folio-version-history-diff');

  // 04 Book compiler.
  await page.goto(`${WRITER}novel/vertical-slice/compile`);
  for (const id of ['compile-cover', 'compile-gimmick-mode', 'export-docx', 'export-print'])
    await tid(id).waitFor({ timeout: 10000 });
  ok('book compiler shows cover, gimmick mode and the 7-format export grid');
  await page.waitForTimeout(300);
  const compileTop = await page.screenshot();
  await tid('export-print').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await composite(page, shotsAt, '04-folio-book-compiler', [compileTop, await page.screenshot()]);

  // 05 Master Lock keypad + Document Doctor (composited side by side).
  await page.goto(`${WRITER}lock`);
  await tid('lock-pinpad').waitFor({ timeout: 10000 });
  for (const d of ['2', '0', '7']) await tid(`pin-key-${d}`).click();
  await page.waitForTimeout(300);
  const lockPng = await page.screenshot();
  await page.evaluate((ns) => {
    localStorage.setItem(
      `${ns}doc/d-orphan`,
      JSON.stringify({
        data: {
          id: 'd-orphan',
          parentFolderId: 'f-gone',
          title: 'Stray',
          blocks: [],
          createdAt: 0,
          updatedAt: 0,
        },
        updatedAt: 0,
      }),
    );
    localStorage.setItem(
      `${ns}meta/item/zz-missing`,
      JSON.stringify({ data: { tags: [] }, updatedAt: 0 }),
    );
    localStorage.setItem(`${ns}growth/doc:zz-missing`, '{"data":{"points":[}');
  }, NS);
  await page.goto(`${WRITER}doctor`);
  await tid('doctor-issue-0').waitFor({ timeout: 10000 });
  ok(`doctor reports ${await page.locator('[data-testid^="doctor-issue-"]').count()} issues`);
  await page.waitForTimeout(300);
  const doctorPng = await page.screenshot();
  await composite(page, shotsAt, '05-folio-lock-and-doctor', [lockPng, doctorPng]);
  await tid('doctor-repair-all').waitFor();
}

export async function waitFor(url) {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('reader preview server did not start');
}

/** Two 390×844 phone frames side by side in one PNG (top/bottom of a screen, or two screens). */
async function composite(page, shotsAt, name, frames) {
  if (!shotsAt) return;
  const imgs = frames
    .map(
      (buf) =>
        `<img src="data:image/png;base64,${buf.toString('base64')}" width="390" height="844">`,
    )
    .join('<div style="width:12px"></div>');
  const comp = await page.context().browser().newPage({ deviceScaleFactor: 2 });
  await comp.setViewportSize({
    width: 390 * frames.length + 12 * (frames.length - 1),
    height: 844,
  });
  await comp.setContent(`<body style="margin:0;display:flex;background:#000">${imgs}</body>`);
  await comp.screenshot({ path: `${shotsAt}/${name}.png` });
  await comp.close();
}
