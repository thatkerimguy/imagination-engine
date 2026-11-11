import { expect, test, type Page } from '@playwright/test';
import { watchErrors } from './console.ts';

const STUDIO = 'http://127.0.0.1:5174/';

async function turnOnSync(page: Page): Promise<void> {
  await page.getByTestId('rail-settings').click();
  await page.getByTestId('sync').getByRole('button', { name: 'On', exact: true }).click();
  await expect(page.getByTestId('sync-status')).toContainText('Synced at');
}

// Device sync (ADR 0024) between two browsers through the dev server's sync store.
test.describe('device sync', () => {
  test.skip(({ isMobile }) => isMobile, 'Two desktop browsers stand in for two devices.');

  test('a novel written on one device opens and merges on another', async ({ browser }) => {
    const phone = await (await browser.newContext()).newPage();
    const desktop = await (await browser.newContext()).newPage();
    const phoneErrors = watchErrors(phone);
    const desktopErrors = watchErrors(desktop);

    await phone.goto(STUDIO);
    await expect(phone.getByTestId('line-text')).toHaveCount(1);
    await phone.getByTestId('line-text').click();
    await phone.keyboard.type('Written on the phone.');
    const id = await phone.evaluate(() => localStorage.getItem('ie.studio.project'));
    if (!id) throw new Error('no project id');
    await turnOnSync(phone);

    // The other device sees it under "On other devices" and opens it.
    await desktop.goto(STUDIO);
    await expect(desktop.getByTestId('line-text')).toHaveCount(1);
    await turnOnSync(desktop);
    // Newest first, so the phone's novel leads the list even with earlier runs' in the store.
    await desktop.getByTestId('sync-open').first().click();
    await expect
      .poll(() => desktop.evaluate(() => localStorage.getItem('ie.studio.project')))
      .toBe(id);
    await desktop.getByTestId('rail-write').click();
    await expect(desktop.getByTestId('line-text').first()).toHaveText('Written on the phone.');

    // Each device adds a passage; after syncing both have both.
    await desktop.getByTestId('rail-flow').click();
    await desktop.getByRole('button', { name: 'New passage' }).click();
    await desktop.getByTestId('rail-settings').click();
    await desktop.getByTestId('sync-now').click();
    await expect(desktop.getByTestId('sync-status')).toContainText('Synced at');

    await phone.getByTestId('rail-flow').click();
    await phone.getByRole('button', { name: 'New passage' }).click();
    await phone.getByTestId('rail-settings').click();
    await phone.getByTestId('sync-now').click();
    await expect(phone.getByTestId('sync-status')).toContainText('Synced at');
    await phone.getByTestId('rail-flow').click();
    await expect(phone.getByTestId('flow-node')).toHaveCount(3);

    await desktop.getByTestId('sync-now').click();
    await expect(desktop.getByTestId('sync-status')).toContainText('Synced at');
    await desktop.getByTestId('rail-flow').click();
    await expect(desktop.getByTestId('flow-node')).toHaveCount(3);
    expect(phoneErrors).toEqual([]);
    expect(desktopErrors).toEqual([]);
  });
});
