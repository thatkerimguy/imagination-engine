// Web Page scroller: the browser keeps focused fields visible itself.
import type { ReactNode } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

export function PageScroll(props: ScrollViewProps): ReactNode {
  return <ScrollView {...props} />;
}
