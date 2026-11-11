import { expect, test, type Page } from '@playwright/test';
import { watchErrors } from './console.ts';

const STUDIO = 'http://127.0.0.1:5174/';

/** A 16-second, 100 BPM WAV: a deep hit on each bar's first beat, lighter hits between. */
function groove(): Buffer {
  const rate = 22050;
  const n = rate * 16;
  const data = new Float32Array(n);
  for (let b = 0; b * 0.6 < 15.6; b++) {
    const start = Math.round(b * 0.6 * rate);
    const accent = b % 4 === 0;
    for (let i = 0; i < rate * 0.15; i++) {
      const t = i / rate;
      data[start + i] =
        (data[start + i] ?? 0) +
        Math.sin(2 * Math.PI * (accent ? 60 : 1500) * t) * Math.exp(-t * 25) * (accent ? 0.9 : 0.4);
    }
  }
  const out = Buffer.alloc(44 + n * 2);
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + n * 2, 4);
  out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(rate, 24);
  out.writeUInt32LE(rate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++)
    out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, data[i] ?? 0)) * 32767), 44 + i * 2);
  return out;
}

async function openSound(page: Page, isMobile: boolean) {
  await page.goto(STUDIO);
  await expect(page.getByTestId('line-text')).toHaveCount(1);
  if (isMobile) {
    await page.getByTestId('tab-more').tap();
    await page.getByTestId('more-sheet').getByRole('button', { name: 'Sound' }).tap();
  } else {
    await page.getByTestId('rail-sound').click();
  }
  await expect(page.getByTestId('view-sound')).toBeVisible();
}

test.describe('Studio sound', () => {
  test('an imported file gets its beats and downbeats on its own', async ({ page, isMobile }) => {
    const errors = watchErrors(page);
    await openSound(page, isMobile);

    await page
      .getByTestId('import-audio')
      .setInputFiles({ name: 'Groove.wav', mimeType: 'audio/wav', buffer: groove() });
    const track = page.getByTestId('track');
    await expect(track).toHaveCount(1);
    await expect(track.getByTestId('track-status')).toContainText('100 BPM · 4/4', {
      timeout: 20_000,
    });
    await expect(track.getByTestId('beat-strip')).toBeVisible();
    await expect(track.getByTestId('track-license')).toContainText('Free to use');
    // No model downloaded in a fresh browser: the built-in tracker found these beats.
    await expect(track.getByTestId('track-tracker')).toHaveText('Beats by the built-in tracker');

    // The track can now be chosen in a Music block.
    await page.getByTestId(isMobile ? 'tab-write' : 'rail-write').click();
    await page.getByTestId('add-block').click();
    await page.getByTestId('add-block-music').click();
    const block = page.getByTestId('block-music');
    await expect(block.getByTestId('audio-picker')).toHaveValue(/^t/);
    await expect(block.getByTestId('audio-picker').locator('option:checked')).toHaveText('Groove');
    expect(errors).toEqual([]);
  });

  test('offers the Beat This! model as a download, not part of the app', async ({
    page,
    isMobile,
  }) => {
    const errors = watchErrors(page);
    await openSound(page, isMobile);
    await page.getByRole('button', { name: 'Setup' }).click();
    await expect(page.getByTestId('beat-this-download')).toHaveText(
      /Download the model \(191 MB\)/,
    );
    // Stem separation is opt-in too, and only offered where there is a mouse (ADR 0028).
    const stems = page.getByTestId('stems-download');
    await expect(stems).toHaveText(/Download the model \(181 MB\)/);
    if (isMobile) await expect(stems).toBeDisabled();
    else await expect(stems).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test('designs a sound effect from a preset', async ({ page, isMobile }) => {
    const errors = watchErrors(page);
    await openSound(page, isMobile);
    await page.getByRole('button', { name: 'Sound effects' }).click();
    await page.getByTestId('new-sound').click();
    await page.getByTestId('new-sound-laser').click();
    await expect(page.getByTestId('sound')).toHaveCount(1);
    await expect(page.getByTestId('sound')).toContainText('Laser');
    await page.getByRole('button', { name: 'Vary' }).click();
    expect(errors).toEqual([]);
  });
});
