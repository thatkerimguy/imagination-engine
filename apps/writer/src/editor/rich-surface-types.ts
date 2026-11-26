// Contract shared by the native (react-native-enriched-markdown) and plain multiline rich
// surfaces. Every offset is in the run's writer-source coordinates.
import type { ReactNode } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import type { Selection } from './inline-edit.ts';

export interface ActiveFormats {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
}

export const NO_FORMATS: ActiveFormats = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
};

export interface RichSurfaceHandle {
  /** True when the native rich editor owns formatting (toolbar marks go through the handle). */
  readonly native: boolean;
  focus(): void;
  toggleBold(): void;
  toggleItalic(): void;
  toggleUnderline(): void;
  toggleStrike(): void;
  setHeading(level: 1 | 2 | 3): void;
  toggleBulletList(): void;
  insertText(text: string): void;
  getSelection(): Selection;
}

export interface RichSurfaceProps {
  value: string;
  /** Pushed into the input once per change (toolbar edits, mention inserts, undo). */
  selection?: Selection;
  placeholder?: string;
  autoFocus?: boolean;
  samsungSafeIme?: boolean;
  textStyle: StyleProp<TextStyle>;
  minHeight: number;
  /** Rendered (WYSIWYG) text shown over the idle plain input; taps pass through to it. */
  rest?: ReactNode;
  testID?: string;
  onChangeText(value: string): void;
  onSelectionChange(sel: Selection): void;
  onFocus(): void;
  onBlur?(): void;
  onActiveFormatsChange?(formats: ActiveFormats): void;
  onHandle?(handle: RichSurfaceHandle | null): void;
}
