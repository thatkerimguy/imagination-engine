import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { watchErrors } from './console.ts';

const STUDIO = 'http://127.0.0.1:5174/';

async function openPublish(page: Page, isMobile: boolean): Promise<void> {
  if (!isMobile) await page.getByTestId('rail-publish').click();
  else {
    await page.getByTestId('tab-more').tap();
    await page.getByTestId('more-sheet').getByRole('button', { name: 'Publish' }).tap();
  }
  await expect(page.getByTestId('view-publish')).toBeVisible();
}

// Phase 11 (ADR 0022): the auto-playtester, the publish check and the novel file.
test('the Publish view playtests, checks and downloads the novel', async ({
  page,
  isMobile,
}, info) => {
  const errors = watchErrors(page);
  await page.goto(STUDIO);
  await expect(page.getByTestId('line-text')).toHaveCount(1);
  await openPublish(page, isMobile);

  await page.getByTestId('pt-runs').selectOption('100');
  await page.getByTestId('pt-start').click();
  await expect(page.getByTestId('pt-summary')).toContainText('100 runs');
  // A new novel is one passage without an End block: every run just runs out.
  await expect(page.getByTestId('pt-dead-ends')).toContainText('100 runs');
  await expect(page.getByTestId('pt-unseen')).toHaveText('Every passage was reached.');

  // That is a warning, not a blocker.
  await expect(page.getByTestId('pub-items')).toContainText('100 of 100 test runs ran out');
  await expect(page.getByTestId('pub-status')).toHaveText('Ready to publish.');
  await expect(page.getByTestId('publish-credits')).toContainText('Literata');
  await page.getByRole('button', { name: 'Just me' }).click();
  await expect(page.getByTestId('pub-status')).toHaveText('Ready to publish.');

  const downloading = page.waitForEvent('download');
  await page.getByTestId('pub-download').click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.private\.story\.json$/);
  const path = info.outputPath('novel.story.json');
  await download.saveAs(path);
  const doc = JSON.parse(await readFile(path, 'utf8')) as { format: string };
  expect(doc.format).toBe('imagination.story');
  expect(errors).toEqual([]);
});
