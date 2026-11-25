// Writer QA: new-novel flow pass (split out of writer-shots.mjs to keep it under 250 lines).
// New novel → write a paragraph → auto-save survives a reload; gimmick picker honours modules.
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
    await page.getByText('A paragraph typed on the train.').waitFor({ timeout: 10000 });
    ok('auto-save persisted a new paragraph');
  } catch {
    fail('auto-save lost the new paragraph');
  }
  await tid('tool-addGimmick').click();
  await page.getByText(/No gimmicks are enabled/).waitFor({ timeout: 5000 });
  ok('gimmick picker is filtered to enabledModules (none for a new novel)');
}
