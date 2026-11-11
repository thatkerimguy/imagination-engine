import { expect, test } from '@playwright/test';
import { watchErrors } from './console.ts';

const STUDIO = 'http://127.0.0.1:5174/';

// Script view (PLAN §3.3): plain text that turns into blocks and back.
test('Script view turns pasted text into blocks and new passages', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(STUDIO);
  await expect(page.getByTestId('line-text')).toHaveCount(1);

  await page.getByRole('button', { name: 'Script', exact: true }).click();
  const text = page.getByTestId('script-text');
  await text.fill('The rain fell.\n* Go in -> Cellar\n* Leave\n=== Cellar\nIt was dark.\n@end');
  await expect(page.getByTestId('script-status')).toContainText('Not applied yet');
  await page.getByTestId('script-apply').click();
  await expect(page.getByTestId('script-status')).toContainText('New passages: Cellar.');

  // Back in the manuscript, the lines are blocks.
  await page.getByRole('button', { name: 'Manuscript', exact: true }).click();
  await expect(page.getByTestId('block-narration')).toHaveCount(1);
  await expect(page.getByTestId('option')).toHaveCount(2);

  // And the script reads the same back.
  await page.getByRole('button', { name: 'Script', exact: true }).click();
  await expect(text).toHaveValue('The rain fell.\n* Go in -> Cellar\n* Leave');
  expect(errors).toEqual([]);
});
