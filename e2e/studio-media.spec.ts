import { expect, test } from '@playwright/test';
import { watchErrors } from './console.ts';

const STUDIO = 'http://127.0.0.1:5174/';
// A one-pixel PNG: enough for the browser to decode, shrink and re-encode.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

// Optional media (ADR 0026): a picture chosen in a form shows behind the text in Play.
test('a picture block shows its picture behind the text', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(STUDIO);
  await expect(page.getByTestId('line-text')).toHaveCount(1);
  await page.getByTestId('line-text').click();
  await page.keyboard.type('The lamps came on.');

  await page.getByTestId('add-block').click();
  await page.getByTestId('add-block-picture').click();
  const block = page.getByTestId('block-picture');
  await expect(block).toContainText('No picture');
  await block
    .getByTestId('media-file')
    .setInputFiles({ name: 'street.png', mimeType: 'image/png', buffer: PIXEL });
  await expect(block.getByTestId('media-thumb')).toHaveAttribute('src', /^data:image\//);
  await block.getByTestId('media-alt-en').fill('A wet street at night');
  await block.getByTestId('media-dim').selectOption('0.3');

  await page.getByTestId('play-from-here').click();
  const play = page.getByTestId('view-play');
  await expect(play.locator('.story')).toContainText('The lamps came on.');
  // The first tap finishes the typewriter, the next one reads on to the picture block.
  await expect(async () => {
    await play.locator('.story').click();
    await expect(play.getByText('The End')).toBeVisible({ timeout: 500 });
  }).toPass();
  const layer = play.getByTestId('media-layer');
  await expect(layer.locator('img')).toHaveAttribute('alt', 'A wet street at night');
  await expect(layer).toHaveCSS('--ie-media-dim', '0.3');
  expect(errors).toEqual([]);
});

// The bookshelf cover: an optional picture chosen in the novel's sheet, saved in the novel.
test('a novel can have a picture as its bookshelf cover', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(STUDIO);
  await page.getByTestId('project-button').click();
  const sheet = page.getByTestId('project-sheet');
  await expect(sheet.getByTestId('cover-thumb')).toHaveCount(0);
  await sheet
    .getByTestId('cover-file')
    .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: PIXEL });
  await expect(sheet.getByTestId('cover-thumb')).toHaveAttribute('src', /^data:image\//);
  await sheet.getByTestId('cover-remove').click();
  await expect(sheet.getByTestId('cover-thumb')).toHaveCount(0);
  expect(errors).toEqual([]);
});
