// Page IME clearance (Gate 1 fix). Android 15+/16 edge-to-edge windows do not resize for the
// keyboard, so after the IME opens (and Page has added keyboard-height bottom padding) the
// focused field is measured in window space and the ScrollView scrolls it 24 dp above the
// keyboard. Zero native dependencies: react-native-keyboard-controller needs Reanimated.
import { useCallback, useEffect, useRef, type RefObject } from 'react';
import {
  Dimensions,
  Keyboard,
  Platform,
  TextInput,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { computeRevealScroll } from '../editor/keyboard-offset.ts';

const SETTLE_MS = 60;

export function useImeReveal(
  scroll: RefObject<ScrollViewInstance | null>,
): (e: NativeSyntheticEvent<NativeScrollEvent>) => void {
  const y = useRef(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = Keyboard.addListener('keyboardDidShow', (e) => {
      const kb = e.endCoordinates;
      // Conservative keyboard top: whichever estimate sits higher on screen.
      const top = Math.min(kb.screenY, Dimensions.get('window').height - kb.height);
      clearTimeout(timer);
      // Let Page's keyboard padding land first so the content can scroll that far.
      timer = setTimeout(() => {
        TextInput.State.currentlyFocusedInput()?.measureInWindow((_x, fy, _w, h) => {
          const to = computeRevealScroll(fy + h, top, y.current);
          if (to !== null) scroll.current?.scrollTo({ y: to, animated: true });
        });
      }, SETTLE_MS);
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [scroll]);
  return useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    y.current = e.nativeEvent.contentOffset.y;
  }, []);
}
