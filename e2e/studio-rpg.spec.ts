import { expect, test, type Page } from '@playwright/test';
import { watchErrors } from './console.ts';

const STUDIO = 'http://127.0.0.1:5174/';

async function openView(page: Page, isMobile: boolean, id: string, label: string): Promise<void> {
  if (!isMobile) {
    await page.getByTestId(`rail-${id}`).click();
  } else if (await page.getByTestId(`tab-${id}`).isVisible()) {
    await page.getByTestId(`tab-${id}`).tap();
  } else {
    await page.getByTestId('tab-more').tap();
    await page.getByTestId('more-sheet').getByRole('button', { name: label }).tap();
  }
  await expect(page.getByTestId(`view-${id}`)).toBeVisible();
}

test.describe('Studio RPG kit', () => {
  test('builds a shop, a battle and a rule without code, then plays them', async ({
    page,
    isMobile,
  }) => {
    const errors = watchErrors(page);
    await page.goto(STUDIO);
    await expect(page.getByTestId('line-text')).toHaveCount(1);

    // Data: the hero's stats in one click, and an item with a price.
    await openView(page, isMobile, 'data', 'Data');
    await page.getByRole('button', { name: 'Hero' }).click();
    await page.getByTestId('hero-create').click();
    await expect(page.getByTestId('hero-hp')).not.toHaveValue('');
    await page.getByRole('button', { name: 'Items' }).click();
    await page.getByTestId('add-item').click();
    const item = page.getByTestId('item');
    await item.getByTestId('item-name-en').fill('Lantern');
    await item.getByTestId('item-price').fill('5');

    // Write: a shop selling it, then a battle against a new enemy.
    await openView(page, isMobile, 'write', 'Write');
    await page.getByTestId('line-text').click();
    await page.keyboard.type('The market is open.');
    await expect(page.getByTestId('line-text')).toContainText('market');
    await page.getByTestId('add-block').click();
    await page.getByTestId('add-block-shop').click();
    const shopBlock = page.getByTestId('block-shop');
    await expect(shopBlock.getByTestId('shop-item')).toHaveValue(/^it/);
    await page.getByTestId('add-block').click();
    await page.getByTestId('add-block-battle').click();
    const battleBlock = page.getByTestId('block-battle');
    await battleBlock.getByTestId('fight-enemy').selectOption('__new__');
    await expect(battleBlock.getByTestId('battle-win')).toBeVisible();

    // Logic: a rule that listens for the item.
    await openView(page, isMobile, 'logic', 'Logic');
    await page.getByTestId('add-rule').click();
    await page.getByTestId('rule-on').selectOption('gained');
    await expect(page.getByTestId('rule')).toHaveCount(1);

    await openView(page, isMobile, 'write', 'Write');
    await page.getByTestId('play-from-here').click();
    const play = page.getByTestId('view-play');
    const shop = play.getByTestId('shop');
    await expect(async () => {
      if (!(await shop.isVisible())) await play.locator('.play__page').click();
      await expect(shop).toBeVisible({ timeout: 300 });
    }).toPass({ timeout: 10_000 });
    await shop.getByTestId('choice').filter({ hasText: 'Lantern' }).click();
    await expect(play.locator('.story')).toContainText('Bought Lantern');
    await shop.getByTestId('choice').filter({ hasText: 'Leave' }).click();

    const battle = play.getByTestId('battle');
    await expect(battle).toBeVisible();
    for (let i = 0; i < 40 && (await battle.isVisible()); i++)
      await battle.getByTestId('choice').filter({ hasText: 'Attack' }).click();
    await expect(battle).toHaveCount(0);
    await expect(play.locator('.story')).toContainText(/You defeated|defeated you/);
    expect(errors).toEqual([]);
  });
});
