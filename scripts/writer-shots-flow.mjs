// Writer QA: new-novel flow pass (split out of writer-shots.mjs to keep it under 250 lines).
// New novel → write a paragraph → auto-save survives a reload; Classic Novel hides Insert Cue.
export async function flowPass(page, { WRITER, tid, ok, fail }) {
  await page.goto(`${WRITER}new-novel`);
  await tid('novel-title').fill('Flow Test');
  await tid('novel-author').fill('QA');
  await page.getByText('Arc', { exact: true }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByText('Arc 1', { exact: false }).first().waitFor();
  await page.locator('[data-testid^="outline-chapter-"]').first().getByText('Chapter 1').click();
  await tid('tool-addProse').click();
  const prose = page.getByPlaceholder('Write…').last();
  await prose.fill('A paragraph typed on the train.');
  await page.getByTestId('save-status').filter({ hasText: 'Saved' }).waitFor({ timeout: 5000 });
  await page.reload();
  try {
    await page.getByText('A paragraph typed on the train.').first().waitFor({ timeout: 10000 });
    ok('auto-save persisted a new paragraph');
  } catch {
    fail('auto-save lost the new paragraph');
  }
  // OVERHAUL-02: new books default to Classic Novel, which never shows Insert Cue.
  if ((await tid('tool-addGimmick').count()) === 0)
    ok('Classic Novel (new-book default) hides Insert Cue in the toolbar');
  else fail('Classic Novel shows the Insert Cue tool');
}
