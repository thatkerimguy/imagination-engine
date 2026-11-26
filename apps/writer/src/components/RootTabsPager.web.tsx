// Root tab shell (web build for react-native-web / Playwright): Library · Notes · Search as one
// horizontal pager inside the `/` route (Animated + PanResponder). Native builds use the UI-thread
// gesture-handler + Reanimated pager in RootTabsPager.tsx; both share pager-shell.tsx. Compact windows only take the drag; on the rail layout (>= 600 dp) tab
// switches are instant. Swipes from the outer 32 dp belong to the Android system back gesture,
// vertical scrolling and the RecentStrip carousel keep their own touches, and Android back on
// Notes / Search returns to Library before the OS may exit.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  PanResponder,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { resetHeaderScrolled } from '../ui/header-scroll.tsx';
import { usesRail } from '../ui/layout-class.ts';
import { useLayoutClass } from '../ui/use-layout-class.ts';
import { useReduceMotion } from '../ui/use-reduce-motion.ts';
import { useTheme } from '../ui/theme.tsx';
import { PagerPages, SEARCH_TAB as SEARCH, usePagerShell } from './pager-shell.tsx';
import {
  innerHorizontalTouched,
  resetInnerHorizontal,
  setRootTab,
  useRootTab,
} from './root-tab.ts';
import { dragOffset, shouldClaimSwipe, snapTarget, TAB_COUNT } from './tab-pager-math.ts';

const NATIVE = Platform.OS !== 'web';
/** Stiff, critically damped spring: carries the release velocity, never overshoots. */
const SPRING = { stiffness: 320, damping: 36, mass: 1, overshootClamping: true } as const;

export function RootTabsPager(): ReactNode {
  const { colors } = useTheme();
  const index = useRootTab();
  const rail = usesRail(useLayoutClass());
  const reduced = useReduceMotion();
  const [width, setWidth] = useState(() => Dimensions.get('window').width);
  const x = useRef(new Animated.Value(-index * width)).current;
  const { mounted, mount, mountAround } = usePagerShell(index);
  const live = useRef({ index, width, rail, reduced });
  live.current = { index, width, rail, reduced };

  // The tab a running settle is heading for, so the index effect never restarts it.
  const heading = useRef(index);
  /** `velocity` in dp/ms (PanResponder's vx); 0 for taps. */
  const settle = (target: number, instant: boolean, velocity = 0): void => {
    const toValue = -target * live.current.width;
    heading.current = target;
    x.stopAnimation();
    if (instant) x.setValue(toValue);
    else
      Animated.spring(x, {
        toValue,
        velocity: velocity * 1000,
        ...SPRING,
        useNativeDriver: NATIVE,
      }).start();
  };

  // Every index change (swipe, tab bar, rail, deep link, back) animates from here.
  const prev = useRef({ index, width });
  useEffect(() => {
    const resized = prev.current.width !== width;
    const left = prev.current.index;
    prev.current = { index, width };
    mount(index);
    // A swipe release already started this settle (before the re-render); do not restart it.
    if (resized || heading.current !== index || left === index)
      settle(index, resized || rail || reduced);
    if (left === index) return;
    resetHeaderScrolled();
    if (left === SEARCH) Keyboard.dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settle/mount read refs + setters only
  }, [index, width]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          !live.current.rail &&
          !innerHorizontalTouched() &&
          // x0 is only set on grant; the touch began at moveX - dx.
          shouldClaimSwipe(g.moveX - g.dx, g.dx, g.dy, live.current.width),
        onPanResponderGrant: () => {
          x.stopAnimation();
          mountAround(live.current.index);
        },
        onPanResponderMove: (_, g) => {
          const { index: i, width: w } = live.current;
          x.setValue(dragOffset(i, g.dx, w));
        },
        onPanResponderRelease: (_, g) => {
          const { index: i, width: w, reduced: r } = live.current;
          const target = snapTarget(i, g.dx, g.vx, w);
          // Animate first, then commit: the spring is on the UI thread before React re-renders.
          settle(target, r, g.vx);
          if (target !== i) setRootTab(target);
        },
        onPanResponderTerminate: () => settle(live.current.index, live.current.reduced),
        onPanResponderTerminationRequest: () => false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers read the live ref
    [],
  );

  return (
    <View
      style={[styles.viewport, { backgroundColor: colors.canvas }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onTouchStartCapture={resetInnerHorizontal}
      testID="root-tabs-pager"
      {...pan.panHandlers}
    >
      <Animated.View
        style={[styles.row, { width: width * TAB_COUNT, transform: [{ translateX: x }] }]}
      >
        <PagerPages index={index} width={width} mounted={mounted} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  row: { flex: 1, flexDirection: 'row' },
});
