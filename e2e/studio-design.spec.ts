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

/** New novel through the wizard: a kit (or blank), then its suggested look, then Create. */
async function newNovel(page: Page, kit: string): Promise<void> {
  await page.getByTestId('project-button').click();
  await page.getByTestId('project-new').click();
  await page.getByTestId(`wizard-kit-${kit}`).click();
  await page.getByTestId('wizard-next').click();
  await page.getByTestId('wizard-next').click();
  await page.getByTestId('wizard-create').click();
  await expect(page.getByTestId('project-sheet')).toBeHidden();
}

test.describe('Studio screens and themes', () => {
  test('a chat story from a kit in a few clicks, with its HUD and look in Play', async ({
    page,
    isMobile,
  }) => {
    const errors = watchErrors(page);
    await page.goto(STUDIO);
    await expect(page.getByTestId('line-text')).toHaveCount(1);
    await newNovel(page, 'chat');

    await openView(page, isMobile, 'play', 'Play');
    await expect(page.getByTestId('hud')).toContainText('Unknown number');
    await expect(page.locator('.play__frame')).toHaveAttribute('data-story-theme', 'true');
    await expect(page.getByTestId('story')).toHaveAttribute('data-layout', 'chat');
    await expect(page.getByTestId('story')).toContainText('Defne');
    expect(errors).toEqual([]);
  });

  test('a theme and a HUD bar made in Design show in Play', async ({ page, isMobile }) => {
    const errors = watchErrors(page);
    await page.goto(STUDIO);
    await expect(page.getByTestId('line-text')).toHaveCount(1);
    await newNovel(page, 'blank');

    await openView(page, isMobile, 'design', 'Design');
    await page.getByTestId('theme-preset-terminal').click();
    await expect(page.getByTestId('theme-preview')).toHaveAttribute('data-choices', 'underline');
    await page.getByTestId('theme-color-ink').fill('#20301f');
    await expect(page.getByTestId('theme-warning')).toBeVisible();

    await page.getByRole('button', { name: 'Screens' }).click();
    await page.getByTestId('add-screen').click();
    await page.getByTestId('add-screen-hud').click();
    await page.getByTestId('add-component').click();
    await page.getByTestId('add-component-bar').click();
    await page.getByTestId('comp-bar-var').selectOption('__new__');
    await expect(page.getByTestId('screen-preview').locator('.screen__bar')).toBeVisible();

    await openView(page, isMobile, 'write', 'Write');
    await page.getByTestId('line-text').click();
    await page.keyboard.type('The terminal hums.');
    await expect(page.getByTestId('line-text')).toContainText('hums');

    await openView(page, isMobile, 'play', 'Play');
    await expect(page.getByTestId('hud').locator('.screen__bar')).toBeVisible();
    await expect(page.locator('.play__frame')).toHaveAttribute('data-choices', 'underline');
    await expect(page.getByTestId('story')).toContainText('hums');
    expect(errors).toEqual([]);
  });
});
