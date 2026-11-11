import { expect, test, type Page } from '@playwright/test';
import { watchErrors } from './console.ts';
import { swipe } from './touch.ts';

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

test.describe('Studio world and spaces', () => {
  test('builds two joined rooms and a map space, then walks and travels by the map', async ({
    page,
    isMobile,
  }) => {
    const errors = watchErrors(page);
    await page.goto(STUDIO);
    await expect(page.getByTestId('line-text')).toHaveCount(1);

    // World: a room in the middle, then one east of it, joined both ways.
    await openView(page, isMobile, 'world', 'World');
    const map = page.getByTestId('world-editor-map');
    await map.locator('[data-testid="wmap-cell"][data-x="0"][data-y="0"]').click();
    const inspector = page.getByTestId('room-inspector');
    await inspector.getByTestId('room-name-en').fill('Hall');
    await map.locator('[data-testid="wmap-cell"][data-x="1"][data-y="0"]').click();
    await inspector.getByTestId('room-name-en').fill('Garden');
    await expect(inspector.getByTestId('wexit')).toHaveCount(1);
    await expect(inspector.getByTestId('wexit-dir')).toHaveValue('w');
    await expect(map.getByTestId('wmap-room')).toHaveCount(2);

    // Spaces: the map to the left of the story.
    await page.getByRole('button', { name: 'Spaces' }).click();
    await page.getByTestId('add-map-space').click();
    await expect(page.getByTestId('spaces-order')).toContainText('Map 1 · Story');

    // Play from the hall.
    await page.getByRole('button', { name: 'Map', exact: true }).click();
    await map.getByTestId('wmap-room').filter({ hasText: 'Hall' }).click();
    await inspector.getByTestId('room-open-passage').click();
    await expect(page.getByTestId('view-write')).toBeVisible();
    await expect(page.getByTestId('block-exits')).toHaveCount(1);
    await page.getByTestId('play-from-here').click();

    const play = page.getByTestId('view-play');
    const toGarden = play.getByTestId('exit').filter({ hasText: 'Garden' });
    await expect(async () => {
      if (!(await toGarden.isVisible())) await play.locator('.play__story').click();
      await expect(toGarden).toBeVisible({ timeout: 300 });
    }).toPass({ timeout: 10_000 });
    await expect(toGarden).toContainText('East');
    // Walking turns to the garden's own page, whose way out leads back west.
    await toGarden.click();
    const back = play.getByTestId('exit').filter({ hasText: 'Hall' });
    await expect(async () => {
      if (!(await back.isVisible())) await play.locator('.play__story').click();
      await expect(back).toBeVisible({ timeout: 300 });
    }).toPass({ timeout: 10_000 });
    await expect(back).toContainText('West');

    // The map space: a swipe on the phone, the edge on a computer.
    const space = play.getByTestId('space-map');
    if (isMobile) await swipe(page, play.getByTestId('spaces'), 'right');
    else await play.getByTestId('space-edge-left').click();
    await expect(space).toHaveAttribute('aria-hidden', 'false');
    await expect(space.locator('[data-room][aria-current="location"]')).toContainText('Garden');
    await space.getByTestId('map-room').filter({ hasText: 'Hall' }).click();

    // Walking from the map brings the story back, now in the hall.
    await expect(space).toHaveAttribute('aria-hidden', 'true');
    await expect(async () => {
      if (!(await toGarden.isVisible())) await play.locator('.play__story').click();
      await expect(toGarden).toBeVisible({ timeout: 300 });
    }).toPass({ timeout: 10_000 });
    expect(errors).toEqual([]);
  });
});
