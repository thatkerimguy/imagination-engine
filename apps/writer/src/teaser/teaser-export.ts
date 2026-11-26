// Native teaser export: capture the hidden 1080×1920 card view to PNG, then hand it to the
// platform file picker / share sheet through the shared delivery path.
import { deliverBase64 } from '../export/deliver';
import { TEASER_SIZE } from './teaser-model.ts';
import { teaserFilename, type TeaserExportInput, type TeaserExportResult } from './teaser-types.ts';

// react-native-view-shot ships untranspiled TS sources that fail this repo's strict
// `verbatimModuleSyntax` typecheck when imported, so it is loaded lazily and typed locally.
interface ViewShot {
  captureRef(
    target: unknown,
    options: { format: 'png'; width: number; height: number; result: 'base64' },
  ): Promise<string>;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const loadViewShot = (): ViewShot => require('react-native-view-shot') as ViewShot;

export type { TeaserExportInput, TeaserExportResult } from './teaser-types.ts';

export async function exportTeaserPng(input: TeaserExportInput): Promise<TeaserExportResult> {
  try {
    const target = input.viewRef.current;
    if (!target) return { ok: false, message: 'The card is not ready yet.' };
    const base64 = await loadViewShot().captureRef(target, {
      format: 'png',
      width: TEASER_SIZE.width,
      height: TEASER_SIZE.height,
      result: 'base64',
    });
    const filename = teaserFilename(input.stem);
    const status = await deliverBase64(filename, base64, 'image/png');
    return { ok: true, status, filename };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Could not create the image.',
    };
  }
}
