// OVERHAUL-02 shot pack (pack root; chained after the OVERHAUL-01 pack), each in a fresh context:
//   01 Classic Novel (`prose`) chapter in UnifiedEditor: zero cue / Live Preview chrome, one tap edits,
//   02 Chrome Tide (Interactive Studio): continuous prose runs between cue cards, ⚡ + Live Preview,
//   03 Notes kinds (filter + pills) beside a Location note whose Backlinks cite "Snake Eyes",
//   04 New Novel mode picker (Classic Novel selected by default).
import { ID, skipOnboarding } from './lib/writer-fixtures.mjs';

const CHAPTER = 'novel/vertical-slice/chapter/s01/ch01';
const PLACE = { id: 'ov02-harbour-district', title: 'Harbour District' };

async function freshPage(browser, errors) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    colorScheme: 'dark',
  });
  await skipOnboarding(ctx);
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  return page;
}

async function composite(browser, panels, path) {
  const tab = await browser.newPage({ deviceScaleFactor: 2 });
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

const repoReady = (page) =>
  page.waitForFunction(() => '__knWriterRepo' in globalThis, null, { timeout: 20000 });

/** Seeds a Location story-bible node straight into the v2 schema. */
const seedPlace = (page) =>
  page.evaluate(async (place) => {
    const now = new Date().toISOString();
    const text = 'Salt-stained quays under sodium lamps.';
    await globalThis.__knWriterDb.putNodes([
      {
        node: {
          id: place.id,
          kind: 'location',
          parentId: null,
          bookId: null,
          title: place.title,
          subtitle: null,
          position: 0,
          workspaceMode: null,
          coverAssetId: null,
          locked: false,
          deletedAt: null,
          wordCount: 5,
          createdAt: now,
          updatedAt: now,
          metaJson: null,
        },
        body: {
          nodeId: place.id,
          blocksJson: JSON.stringify([{ id: '01M7WD7TGC00000000000OV021', kind: 'prose', text }]),
          plainText: text,
          updatedAt: now,
        },
        links: [],
      },
    ]);
  }, PLACE);

const countProse = async () =>
  (await globalThis.__knWriterRepo.getChapter('vertical-slice', 's01', 'ch01')).blocks.filter(
    (b) => b.kind === 'prose',
  ).length;

export async function ov02Pass(browser, { WRITER, packAt, ok, fail }) {
  const errors = [];
  const path = (name) => `${packAt}/${name}.png`;
  const run = `prose-text-${ID.snake}`;

  // 01 — Classic Novel: flip the demo to `prose`, then prove zero gimmick chrome + single tap.
  const a = await freshPage(browser, errors);
  await a.goto(WRITER);
  await repoReady(a);
  await a.evaluate(() => globalThis.__knWriterRepo.setWorkspaceMode('vertical-slice', 'prose'));
  await a.goto(`${WRITER}${CHAPTER}`);
  await a.getByTestId(run).waitFor({ timeout: 20000 });
  const chrome = {
    preview: await a.getByTestId('preview-button').count(),
    cue: await a.getByTestId('tool-addGimmick').count(),
    pills: await a.locator('[data-testid^="pill-"]').count(),
  };
  if (!chrome.preview && !chrome.cue && !chrome.pills)
    ok('Classic Novel editor: no Live Preview, no Insert Cue, no cue pills');
  else fail(`Classic Novel shows gimmick chrome: ${JSON.stringify(chrome)}`);
  await a.getByTestId(run).click();
  const focused = await a.evaluate((id) => document.activeElement?.dataset?.testid === id, run);
  if (focused) ok('one tap on a prose run focuses it (no double-tap trap)');
  else fail('a single tap did not focus the prose run');
  // Typing a blank line inside a run starts a new paragraph = a new prose block, same surface.
  const tail = a.locator('textarea[data-testid^="prose-text-"]').last();
  const before = await a.evaluate(countProse);
  await tail.fill(`${await tail.inputValue()}\n\nThe tide came in under the door.`);
  await a.getByTestId('save-status').filter({ hasText: 'Saved' }).waitFor({ timeout: 8000 });
  await a.reload();
  await a.getByTestId(run).waitFor({ timeout: 20000 });
  const after = await a.evaluate(countProse);
  const values = await a
    .locator('textarea[data-testid^="prose-text-"]')
    .evaluateAll((els) => els.map((el) => el.value));
  if (after === before + 1 && values.some((v) => v.includes('\n\nThe tide came in')))
    ok('a blank line splits a run into a new prose block, still one continuous surface');
  else fail(`run split not persisted (${before} → ${after} prose blocks)`);
  await a.waitForTimeout(300);
  await a.screenshot({ path: path('01-prose-mode-clean-editor') });
  await a.context().close();

  // 02 — Interactive Studio (Chrome Tide as shipped): runs interleaved with cue cards.
  const b = await freshPage(browser, errors);
  await b.goto(`${WRITER}${CHAPTER}`);
  await b.getByTestId(`pill-${ID.chat}`).waitFor({ timeout: 20000 });
  await b.getByTestId('preview-button').waitFor();
  await b.getByTestId('tool-addGimmick').waitFor();
  const runs = await b.locator('[data-testid^="run-"]').count();
  if (runs >= 2)
    ok(`Interactive Studio: ${runs} prose runs interleaved with cue cards, ⚡ + Live Preview`);
  else fail(`expected prose runs between cue cards, saw ${runs}`);
  await b.getByTestId(run).click();
  await b.waitForTimeout(300);
  await b.screenshot({ path: path('02-interactive-mode-editor') });

  // 03 — `[[Harbour District]]` typed in Snake Eyes → live backlink on the Location note.
  await repoReady(b);
  await seedPlace(b);
  const area = b.getByTestId(run);
  await area.fill(`${await area.inputValue()} The quays of [[Harbour District]] glittered.`);
  await b.getByTestId('save-status').filter({ hasText: 'Saved' }).waitFor({ timeout: 8000 });
  await b.goto(`${WRITER}folders`);
  await b.getByTestId('notes-kind-filter-location').click();
  await b.getByTestId(`kind-pill-${PLACE.id}`).waitFor({ timeout: 10000 });
  ok('Notes kind filter shows the Location with its kind pill');
  const list = await b.screenshot();
  await b.goto(`${WRITER}folders/note/${PLACE.id}`);
  await b.getByTestId('backlinks-section').waitFor({ timeout: 10000 });
  const toggle = b.getByTestId('backlinks-toggle');
  if (!(await b.getByTestId('backlink-ch01').count())) await toggle.click();
  try {
    await b.getByTestId('backlink-ch01').waitFor({ timeout: 8000 });
    ok('Backlinks panel cites Snake Eyes after typing [[Harbour District]]');
  } catch {
    fail('Location note shows no backlink from Snake Eyes');
  }
  await b.getByTestId('backlinks-section').scrollIntoViewIfNeeded();
  await composite(browser, [list, await b.screenshot()], path('03-notes-kinds-and-backlinks'));
  await b.context().close();

  // 04 — New Novel: calm Classic Novel / Interactive Studio picker, Classic selected.
  const c = await freshPage(browser, errors);
  await c.goto(`${WRITER}new-novel`);
  await c.getByTestId('new-novel-mode').waitFor({ timeout: 20000 });
  const checked = await c.getByTestId('mode-option-prose').getAttribute('aria-checked');
  if (checked === 'true') ok('New Novel defaults to Classic Novel');
  else fail(`Classic Novel not selected by default (aria-checked=${checked})`);
  await c.getByTestId('new-novel-mode').scrollIntoViewIfNeeded();
  await c.screenshot({ path: path('04-new-novel-mode-picker') });
  await c.context().close();

  if (errors.length) fail(`overhaul-02 pack console errors:\n  ${errors.join('\n  ')}`);
  else ok('overhaul-02 pack: zero console errors');
}
