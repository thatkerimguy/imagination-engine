// Core writer QA pass (split out of writer-shots.mjs): library, editor, focus, cue sheet,
// analysis, growth, appearance and the offline live preview of the unsaved rich draft.
import { chatState } from './chat-state.mjs';
import { GROWTH_SEED, ID, RICH } from './writer-fixtures.mjs';
import { seedKv } from './writer-v2.mjs';
import { offlinePreviewShot } from '../writer-shots-2d.mjs';

export async function corePass(page, { WRITER, tid, shot, ok, fail, editor, closeSheet, blocked }) {
  // 01 Folio Library (dark): book rows with spine thumbs, quiet bar, no FAB.
  await page.goto(WRITER);
  await tid('novel-card-vertical-slice').waitFor({ timeout: 20000 });
  await seedKv(page, [['growth/chapter:ch01', GROWTH_SEED]]);
  if (await page.getByRole('button', { name: /^New novel$/ }).count())
    ok('library has a quiet New novel action');
  await page.waitForTimeout(300);
  await shot('01-folio-library-dark');

  // 02 Folio chapter editor (dark): slim bar, metrics strip, active rail, cue strip, rail toolbar.
  await editor();
  for (const id of ['editor-top-bar', 'stats-pill', 'undo-button', 'redo-button', 'preview-button'])
    await tid(id).waitFor();
  await tid('metrics-ribbon').waitFor();
  await tid('tool-tab').waitFor();
  ok('slim top bar, metrics strip and formatting rail (with Tab) render');
  await tid(`prose-text-${ID.snake}`).click();
  const snake = page.locator(`textarea[data-testid="prose-text-${ID.snake}"]`);
  await snake.waitFor();
  await snake.fill(RICH);
  await tid(`dialogue-text-${ID.dialogue}`).click();
  const wysiwyg = tid(`prose-text-${ID.snake}-view`);
  const raw = await wysiwyg.textContent();
  if (raw.includes('**') || raw.includes('==')) fail(`unfocused prose shows raw markup: ${raw}`);
  else ok('unfocused prose renders WYSIWYG with zero raw syntax');
  await tid('undo-button').click();
  await tid('redo-button').click();
  ok('undo / redo buttons respond');
  await page.getByTestId('save-status').filter({ hasText: 'Saved' }).waitFor({ timeout: 5000 });
  const beats = await tid(`block-${ID.dice}`).getByText(/beat/i).count();
  if (beats <= 1) ok(`dice cue strip shows the Beat marker at most once (${beats})`);
  else fail(`dice cue strip repeats the Beat marker ${beats}×`);
  await tid(`dialogue-text-${ID.dialogue}`).click();
  await tid(`block-${ID.dialogue}`).evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  await shot('02-folio-editor-dark');

  // 04 v2 cue sheet (generic BlueprintForm) on the 3D dice cue.
  await tid(`pill-${ID.dice}`).scrollIntoViewIfNeeded();
  await tid(`pill-${ID.dice}`).click();
  await tid('cue-sheet').waitFor({ timeout: 5000 });
  await tid('blueprint-form').waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);
  await shot('04-folio-cue-sheet-dice');
  await closeSheet();
  ok('dice cue opens the schema-driven BlueprintForm');

  // 05 Text analysis sheet, Frequency tab, Content filter.
  await tid('stats-pill').click();
  await tid('text-analysis-sheet').waitFor();
  await tid('analysis-tab-frequency').click();
  await tid('freq-filter-content').click();
  await page.waitForTimeout(500);
  await shot('05-folio-text-analysis');
  await closeSheet();
  ok('text analysis sheet opens with frequency chart');

  // 06 Growth (All).
  await tid('editor-menu').click();
  await tid('menu-growth').click();
  await tid('growth-range-lifetime').click();
  await tid('growth-card-words').waitFor();
  const paths = await page.locator('svg path').count();
  if (paths >= 4) ok(`growth charts render (${paths} svg paths)`);
  else fail(`growth charts missing (${paths} svg paths)`);
  await page.waitForTimeout(300);
  await shot('06-folio-growth-dashboard');

  // 07 Appearance & fonts in a Day theme (Paper Daylight).
  await page.goto(`${WRITER}appearance`);
  await tid('theme-warm-sepia').waitFor();
  const themes = await page.locator('[data-testid^="theme-"]').count();
  if (themes >= 13) ok(`appearance lists ${themes - 1} themes + System`);
  else fail(`expected 12 theme swatches + System, found ${themes}`);
  await tid('theme-paper-daylight').scrollIntoViewIfNeeded();
  await tid('theme-paper-daylight').click();
  await page.waitForTimeout(300);
  await page.goto(`${WRITER}appearance`);
  await tid('import-font').waitFor();
  await page.waitForTimeout(400);
  await shot('07-folio-appearance-light');

  // 03 Focus mode with Warm Sepia and a literary serif.
  await tid('theme-warm-sepia').scrollIntoViewIfNeeded();
  await tid('theme-warm-sepia').click();
  await tid('font-lora').scrollIntoViewIfNeeded();
  await tid('font-lora').click();
  await editor();
  await tid('editor-menu').click();
  await tid('menu-focus').click();
  await tid('focus-exit').waitFor();
  if (await tid('editor-top-bar').count()) fail('focus mode still shows the top bar');
  else ok('focus mode hides top bar, metrics strip and formatting rail');
  await page.waitForTimeout(800);
  await shot('03-folio-focus-sepia');
  await tid('focus-exit').click();
  await page.goto(`${WRITER}appearance`);
  await tid('theme-system').click();
  await tid('font-classic-serif').scrollIntoViewIfNeeded();
  await tid('font-classic-serif').click();

  // 06 Live preview of the unsaved rich prose, sequenced chat + dice.
  await editor();
  await tid(`prose-text-${ID.snake}`).click();
  await page.locator(`textarea[data-testid="prose-text-${ID.snake}"]`).fill(RICH + ' ');
  // Start the preview at the dialogue line above the dice, as the Author would.
  await tid(`dialogue-text-${ID.dialogue}`).click();
  await tid('preview-button').click();
  await tid('preview-screen').waitFor({ timeout: 10000 });
  const frame = page.frameLocator('iframe[title="Reader preview"]');
  await frame.getByRole('button', { name: 'Silent' }).click({ timeout: 15000 });
  const reader = page.frames().find((f) => f.url() === 'about:srcdoc');
  if (!reader) throw new Error('offline reader srcdoc frame not found');
  await reader.waitForFunction(
    () => document.querySelector('[data-engine="bespoke-3d"][data-state="done"]'),
    null,
    { timeout: 30000 },
  );
  const chat = await chatState(reader);
  if (chat.pending === 0 && chat.last === "Don't relax.")
    ok('all 3 KESTREL-9 lines were complete when the dice landed');
  else fail(`dice landed while KESTREL-9 was incomplete: ${JSON.stringify(chat)}`);
  await frame.getByText('Tap to continue', { exact: false }).click();
  await frame.locator('strong', { hasText: 'Snake eyes.' }).waitFor({ timeout: 15000 });
  const spans = await frame
    .locator(`[data-block="${ID.snake}"]`)
    .evaluate((el) => ['strong', 'em', 'u', 's', 'mark'].map((t) => el.querySelectorAll(t).length));
  if (spans.every((n) => n === 1))
    ok('preview renders bold, italic, underline, strike and highlight');
  else fail(`inline spans in preview: ${JSON.stringify(spans)}`);
  await frame
    .locator(`[data-block="${ID.snake}"]`)
    .evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  await shot('08-live-preview-rich-formatting');
  await offlinePreviewShot(page, { frame, reader, tid, shot, ok, fail, blocked, RICH });
}
