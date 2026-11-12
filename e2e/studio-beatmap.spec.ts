import { expect, test, type Page } from '@playwright/test';
import { SAMPLE_OSU } from '../packages/rhythm/src/beatmap/fixture.ts';
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

/** A short mono WAV with a click on every beat at 120 BPM from one second in. */
function clickTrack(seconds: number, rate = 22050): Buffer {
  const n = seconds * rate;
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
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const beat = (t - 1) % 0.5;
    const s = t >= 1 && beat < 0.03 ? Math.sin(2 * Math.PI * 880 * t) * Math.exp(-beat * 120) : 0;
    out.writeInt16LE(Math.round(s * 0.8 * 32767), 44 + i * 2);
  }
  return out;
}

async function importSample(page: Page): Promise<void> {
  await page.getByTestId('beatmap-file').setInputFiles([
    { name: 'Lantern Steps (Easy).osu', mimeType: 'text/plain', buffer: Buffer.from(SAMPLE_OSU) },
    { name: 'song.wav', mimeType: 'audio/wav', buffer: clickTrack(9) },
  ]);
  await expect(page.getByTestId('beatmap-status')).toHaveText('Imported 1 beatmap.');
  await expect(page.getByTestId('beatmap-pick')).toContainText('Lantern Steps · Easy · 6 notes');
}

test.describe('Studio beatmaps', () => {
  test('imports a chart with its song, edits notes, timing and settings, and test plays it', async ({
    page,
    isMobile,
  }) => {
    test.setTimeout(60_000);
    const errors = watchErrors(page);
    await page.goto(STUDIO);
    await expect(page.getByTestId('line-text')).toHaveCount(1);
    await openView(page, isMobile, 'beatmaps', 'Beatmaps');
    await expect(page.getByTestId('view-beatmaps')).toContainText('No beatmaps yet.');
    await importSample(page);

    // A circle placed at the playhead, then its time typed in.
    const notes = page.getByTestId('bmed-notes');
    await notes.getByRole('button', { name: 'Circle', exact: true }).click();
    await page.getByTestId('bmed-field').click({ position: { x: 60, y: 60 } });
    await expect(page.getByTestId('beatmap-pick')).toContainText('7 notes');
    const inspector = page.getByTestId('bmed-inspector');
    await expect(inspector).toContainText('Circle');
    await inspector.getByTestId('bmed-note-time').fill('8000');
    await inspector.getByTestId('bmed-note-time').press('Enter');
    await expect(inspector.getByTestId('bmed-note-time')).toHaveValue('8000');

    // A slider drawn with three clicks and finished; Undo takes it away again.
    await notes.getByRole('button', { name: 'Slider', exact: true }).click();
    const field = page.getByTestId('bmed-field');
    await field.click({ position: { x: 80, y: 160 } });
    await field.click({ position: { x: 160, y: 90 } });
    await field.click({ position: { x: 240, y: 160 } });
    await page.getByTestId('bmed-finish-slider').click();
    await expect(page.getByTestId('beatmap-pick')).toContainText('8 notes');
    await expect(inspector).toContainText('Slider');
    await expect(inspector.getByTestId('bmed-note-curve')).toHaveValue('bezier');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByTestId('beatmap-pick')).toContainText('7 notes');

// The playhead follows the song and stops by itself; the clock shows where it is.
    await expect(page.getByTestId('bmed-play')).toBeEnabled();
    await page.getByTestId('bmed-play').click();
    await expect(page.getByTestId('bmed-play')).toHaveText('Pause');
    await expect(page.getByTestId('bmed-clock')).not.toHaveText('0:00.500');
    await page.getByTestId('bmed-play').click();
    await expect(page.getByTestId('bmed-play')).toHaveText('Play');

    // Timing: the imported tempo, and moving the whole chart.
    const view = page.getByTestId('view-beatmaps');
    await view.getByRole('button', { name: 'Timing', exact: true }).click();
    await expect(page.getByTestId('bmed-tempo')).toHaveCount(1);
    await expect(page.getByTestId('bmed-tempo-bpm')).toHaveValue('120');
await page.getByTestId('bmed-shift-10').click();
    await expect(page.getByTestId('bmed-tempo-time')).toHaveValue('1010');
    await page.getByTestId('bmed-shift--10').click();
    await expect(page.getByTestId('bmed-tempo-time')).toHaveValue('1000');

    // Settings: a name in both languages, and the song that came with the chart.
    await view.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByTestId('bmed-name-en').fill('Lantern');
    await expect(page.getByTestId('beatmap-pick')).toContainText('Lantern · 7 notes');
    await expect(page.getByTestId('bmed-song').locator('option:checked')).toHaveText(
      'Lantern Steps · Nobody',
    );

// A test play from the start, watched, ends in a perfect rank and closes again.
    await view.getByRole('button', { name: 'Notes', exact: true }).click();
    // A test play can be closed from its start card without playing.
    await page.getByTestId('bmed-test-play').click();
    await page.getByTestId('beatmap-start').getByTestId('beatmap-close').click();
    await expect(page.getByTestId('bmed-test')).toHaveCount(0);
    await page.getByTestId('bmed-test-play').click();
    const start = page.getByTestId('beatmap-start');
    await expect(start).toBeVisible();
    await start.locator('[data-mod="auto"]').click();
    await start.getByTestId('beatmap-go').click();
    const result = page.getByTestId('beatmap-result');
    await expect(result).toBeVisible({ timeout: 25_000 });
    await expect(result.getByTestId('beatmap-rank')).toHaveText('S+');
    await result.getByTestId('beatmap-done').click();
    await expect(page.getByTestId('bmed-test')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('a Rhythm block plays the beatmap in Play and branches on the result', async ({
    page,
    isMobile,
  }) => {
    test.setTimeout(60_000);
    const errors = watchErrors(page);
    await page.goto(STUDIO);
    await expect(page.getByTestId('line-text')).toHaveCount(1);
    await openView(page, isMobile, 'beatmaps', 'Beatmaps');
    await importSample(page);

    await openView(page, isMobile, 'write', 'Write');
    await page.getByTestId('add-block').click();
    await page.getByTestId('add-block-rhythm').click();
    const block = page.getByTestId('block-rhythm');
    await expect(block.getByTestId('rhythm-beatmap').locator('option:checked')).toHaveText(
      'Lantern Steps · Easy',
    );
    await expect(page.getByTestId('problems')).not.toContainText('Rhythm block');
    await expect(block.getByTestId('rhythm-win')).toBeVisible();

    // The Edit button opens the beatmap in its workspace.
    await block.getByTestId('rhythm-edit').click();
    await expect(page.getByTestId('view-beatmaps')).toBeVisible();
    await expect(page.getByTestId('bmed-notes')).toBeVisible();

    await openView(page, isMobile, 'play', 'Play');
    const play = page.getByTestId('view-play');
    const start = play.getByTestId('beatmap-start');
    await expect(async () => {
      if (!(await start.isVisible())) await play.getByTestId('story').click();
      await expect(start).toBeVisible({ timeout: 300 });
    }).toPass({ timeout: 20_000 });
    await start.locator('[data-mod="auto"]').click();
    await start.getByTestId('beatmap-go').click();
    const result = play.getByTestId('beatmap-result');
    await expect(result).toBeVisible({ timeout: 25_000 });
    await expect(result).toHaveAttribute('data-won', 'true');
    await result.getByTestId('beatmap-done').click();
    await expect(play.getByTestId('beatmap')).toHaveCount(0);
    await expect(play).toContainText('Lantern Steps · Easy: cleared · accuracy 100%');
    expect(errors).toEqual([]);
  });
});
