// Folio type: editorial serif for titles and literary text, a clean system sans with tabular
// figures for chrome and metadata.
import { Platform, type TextStyle } from 'react-native';
import { size } from './tokens.ts';

export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });
export const sans = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
});
export const mono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, Menlo, Consolas, monospace',
});

/** Editorial exception: the Author's prose and dialogue stay in a literary serif. */
export const proseFont = serif;

/** Tabular figures for counts, timestamps and metrics. */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export type TypeVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'serifBody'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'meta'
  | 'caption'
  | 'overline';

const f = (
  fontFamily: string,
  fontSize: number,
  lineHeight: number,
  fontWeight: TextStyle['fontWeight'] = '400',
  letterSpacing = 0,
): TextStyle => ({ fontFamily, fontSize, lineHeight, fontWeight, letterSpacing });

/** Serif for titles and literary text; sans for UI chrome and metadata. */
export const type: Record<TypeVariant, TextStyle> = {
  display: f(serif, size.display, 34, '600', -0.2),
  title: f(serif, size.xl, 28, '600', -0.1),
  heading: f(serif, size.lg, 23, '600'),
  serifBody: f(serif, size.md + 1, 25),
  body: f(sans, size.md, 21),
  bodyStrong: f(sans, size.md, 21, '600'),
  label: f(sans, size.sm, 18, '500', 0.1),
  meta: { ...f(sans, size.sm, 18), ...tabular },
  caption: { ...f(sans, size.xs, 15, '400', 0.2), ...tabular },
  overline: { ...f(sans, size.xs, 14, '600', 1.2), textTransform: 'uppercase' },
};
