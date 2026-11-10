import { expect, test } from '@playwright/test';
import { watchErrors } from './console.ts';
import { PLAYER, tapUntil } from './player-helpers.ts';

// `?kit=` plays a kit's starter story in development builds (the Player bundles one sample).
const GAMEBOOK = `${PLAYER}?kit=gamebook`;

test.describe('Player screens and themes', () => {
  test('title screen, HUD, a panel, and the story look setting', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(GAMEBOOK);
    const screen = page.getByTestId('screen');
    await expect(screen).toContainText('The Sunken Keep');
    await expect(screen.getByTestId('screen-button')).toHaveText(['Start']);
    await expect(page.locator('html')).toHaveAttribute('data-story-theme', 'true');

    await screen.getByTestId('screen-button').click();
    await expect(screen).toBeHidden();
    await expect(page.getByTestId('story')).toContainText('The keep rises');
    const hud = page.getByTestId('hud');
    await expect(hud).toContainText('Stamina');
    await expect(hud).toContainText('12 / 12');

    // The sheet is one of the story's own panels, with tabs; Escape closes it.
    await hud.getByTestId('screen-button').filter({ hasText: 'Sheet' }).click();
    await expect(screen).toContainText('Adventure sheet');
    await screen.getByRole('tab', { name: 'Pack' }).click();
    await expect(screen).toContainText('empty');
    await page.keyboard.press('Escape');
    await expect(screen).toBeHidden();
    await expect(page.getByTestId('menu')).toHaveAttribute('data-open', 'false');

    // Back on the title screen, Continue picks up where the reader was.
    await tapUntil(page, page.getByTestId('choice').first());
    await page.reload();
    await expect(screen.getByTestId('screen-button')).toHaveText(['Start', 'Continue']);
    await screen.getByTestId('screen-button').filter({ hasText: 'Continue' }).click();
    await expect(page.getByTestId('choice').first()).toBeVisible();

    // A reader can keep their own Paper or Night instead.
    await page.getByTestId('menu-zone').click();
    await page.getByTestId('menu-settings').click();
    await page
      .getByRole('group', { name: 'Use the story’s look' })
      .getByRole('button', { name: 'Off' })
      .click();
    await expect(page.locator('html')).not.toHaveAttribute('data-story-theme', 'true');
    expect(errors).toEqual([]);
  });
});
