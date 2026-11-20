// Editor page typography derived from writer prefs: font family (lazy-loaded), size, line
// height, margins, first-line indent and default alignment.
import type { TextStyle } from 'react-native';
import { useFontFamily } from '../fonts/loader';
import type { MarginPreset, TextAlign } from '../store/writer-prefs.ts';
import { useWriterPrefs } from './theme.tsx';

export const MARGIN_DP: Readonly<Record<MarginPreset, number>> = {
  compact: 12,
  comfortable: 20,
  wide: 32,
};

export interface EditorTypography {
  fontFamily: string;
  fontSize: number;
  /** Absolute line height in dp. */
  lineHeight: number;
  /** Horizontal page padding in dp. */
  margin: number;
  firstLineIndent: boolean;
  defaultAlign: TextAlign;
  /** Ready-made body text style. */
  body: TextStyle;
}

/** Heading scale relative to the body size (H1–H3). */
export const HEADING_SCALE: Readonly<Record<1 | 2 | 3, number>> = { 1: 1.6, 2: 1.35, 3: 1.15 };

export function useEditorTypography(): EditorTypography {
  const [prefs] = useWriterPrefs();
  const fontFamily = useFontFamily(prefs.fontId);
  const lineHeight = Math.round(prefs.fontSize * prefs.lineHeight);
  return {
    fontFamily,
    fontSize: prefs.fontSize,
    lineHeight,
    margin: MARGIN_DP[prefs.marginPreset],
    firstLineIndent: prefs.firstLineIndent,
    defaultAlign: prefs.defaultAlign,
    body: { fontFamily, fontSize: prefs.fontSize, lineHeight, textAlign: prefs.defaultAlign },
  };
}
