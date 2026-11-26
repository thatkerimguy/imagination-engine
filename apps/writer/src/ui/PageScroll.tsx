// Native Page scroller: react-native-keyboard-controller's KeyboardAwareScrollView keeps the
// focused field `bottomOffset` dp above the IME, frame-synced on the UI thread (Gate 2 C1:
// Publishing fields stay visible above Gboard). Replaces the old keyboard-padding + 60 ms
// measure-and-scroll workaround.
import type { ReactNode } from 'react';
import type { ScrollViewProps } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

/** Clearance between the focused field and the keyboard's top edge. */
export const IME_BOTTOM_OFFSET = 24;

export function PageScroll(props: ScrollViewProps): ReactNode {
  return <KeyboardAwareScrollView bottomOffset={IME_BOTTOM_OFFSET} {...props} />;
}
