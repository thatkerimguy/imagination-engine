import { expect, test } from '@playwright/test';
import { watchErrors } from './console.ts';

const STUDIO = 'http://127.0.0.1:5174/';

// The minigame builder (ADR 0025): parts and rules in forms, played in the try-out.
test('a minigame built from parts and rules plays in the try-out', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(STUDIO);
  await expect(page.getByTestId('line-text')).toHaveCount(1);

  await page.getByTestId('add-block').click();
  await page.getByTestId('add-block-minigame').click();
  const block = page.getByTestId('block-minigame');
  await block.getByTestId('mg-template').selectOption('built');

  // The starter: a Light meter, a Pump button and two rules. Make the lantern smaller.
  await expect(block.getByTestId('bg-meter')).toHaveCount(1);
  await expect(block.getByTestId('bg-rule')).toHaveCount(2);
  await expect(block.getByTestId('mg-store-light')).toBeVisible();
  await block.getByTestId('bg-meter-max-0').fill('3');
  await block.getByTestId('bg-button-0-en').fill('Pump hard');
  // The win rule asks for 10; lower it to the new maximum.
  await block.getByTestId('bg-condition').locator('input').fill('3');

  await block.getByTestId('mg-try').click();
  const game = block.getByTestId('mg-try-box').getByTestId('minigame');
  const pump = game.getByTestId('minigame-button-0');
  await expect(pump).toHaveText('Pump hard');
  for (let i = 0; i < 3; i++) await pump.click();
  await expect(game.getByTestId('minigame-result')).toContainText('Success');
  await game.getByTestId('minigame-continue').click();
  await expect(block.getByTestId('mg-try-result')).toContainText('Success · score 100');
  expect(errors).toEqual([]);
});
