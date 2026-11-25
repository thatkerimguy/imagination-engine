// Whether a scroll view has left its top edge (drives the top bar's hairline). Re-renders only
// when the flag flips, not on every scroll event.
import { useCallback, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

type ScrollHandler = (e: NativeSyntheticEvent<NativeScrollEvent>) => void;

export function useScrolledFlag(threshold = 4): [boolean, ScrollHandler] {
  const [scrolled, setScrolled] = useState(false);
  const flag = useRef(false);
  const onScroll = useCallback<ScrollHandler>(
    (e) => {
      const next = e.nativeEvent.contentOffset.y > threshold;
      if (flag.current === next) return;
      flag.current = next;
      setScrolled(next);
    },
    [threshold],
  );
  return [scrolled, onScroll];
}
