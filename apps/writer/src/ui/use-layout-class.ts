// Window size class from useWindowDimensions, so rotation, foldable posture and desktop windowing
// re-render with the right class (see layout-class.ts for the breakpoints).
import { useWindowDimensions } from 'react-native';
import { layoutClassFor, type LayoutClass } from './layout-class.ts';

export function useLayoutClass(): LayoutClass {
  return layoutClassFor(useWindowDimensions().width);
}
