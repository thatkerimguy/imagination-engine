import { expect, test, type Page } from '@playwright/test';
import { watchErrors } from './console.ts';
import { PLAYER, playToCrossroads, tapUntil } from './player-helpers.ts';

/** Attacks until the battle on screen is over. */
async function fightOut(page: Page): Promise<void> {
  const battle = page.getByTestId('battle');
  for (let i = 0; i < 40 && (await battle.isVisible()); i++) {
    await battle.getByTestId('choice').filter({ hasText: 'Attack' }).click();
  }
  await expect(battle).toHaveCount(0);
}

test.describe('Player RPG kit', () => {
  test('a shop, a rule, a battle, and the character sheet', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(PLAYER);
    await playToCrossroads(page);
    await page.getByTestId('choice').filter({ hasText: 'Duck into the night market' }).click();

    const shop = page.getByTestId('shop');
    await tapUntil(page, shop);
    await expect(page.getByTestId('story')).toContainText('Quest: The stranger');
    await expect(page.getByTestId('story')).toContainText('You hand over 1 gold');
    await expect(shop).toContainText('7 Gold');
    await shop.getByTestId('choice').filter({ hasText: 'Lantern' }).click();
    await expect(page.getByTestId('story')).toContainText('Bought Lantern');
    await expect(shop).toContainText('1 Gold');
    await shop.getByTestId('choice').filter({ hasText: 'Leave' }).click();

    await tapUntil(page, page.getByTestId('battle'));
    await expect(page.getByTestId('battle')).toContainText('The pickpocket');
    await fightOut(page);
    await expect(page.getByTestId('story')).toContainText('You defeated The pickpocket');

    // The rule turned the lantern into the lamp the crossroads asks for.
    await tapUntil(page, page.getByTestId('choice').filter({ hasText: 'Raise the lamp' }));

    await page.getByTestId('menu-zone').click();
    await page.getByTestId('menu-sheet').click();
    const sheet = page.getByTestId('sheet-dialog');
    await expect(sheet.getByTestId('sheet-items')).toContainText('Lantern');
    await expect(sheet.getByTestId('sheet-items')).toContainText('Small knife');
    await expect(sheet.getByTestId('sheet-quests')).toContainText('The stranger');
    await expect(sheet).toContainText('HP');
    expect(errors).toEqual([]);
  });
});
