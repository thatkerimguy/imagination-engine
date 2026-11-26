// Root tab shell (native): Library · Notes · Search as one horizontal pager inside the `/` route.
// Finger tracking AND the release settle run 100% on the UI thread (react-native-gesture-handler
// v3 `usePanGesture` + Reanimated shared values / `withSpring`), so the swipe follows at the
// display's full refresh rate (120 Hz) even while JS is busy. Contracts kept from 06A:
// - the outer 32 dp on both edges belong to the Android 13–16 system back gesture;
// - vertical scrolling and the RecentStrip carousel keep their own touches (manual activation:
//   the pager only claims a clearly horizontal move, and fails on vertical intent);
// - leaving Search dismisses its keyboard; back on Notes / Search returns to Library;
// - tablet rail (>= 600 dp) and Reduce Motion switch instantly, with no drag capture.
// The web build (RootTabsPager.web.tsx) keeps Animated + PanResponder for react-native-web.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Dimensions, Keyboard, StyleSheet, View } from 'react-native';
import { GestureDetector, GestureStateManager, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { resetHeaderScrolled } from '../ui/header-scroll.tsx';
import { usesRail } from '../ui/layout-class.ts';
import { useLayoutClass } from '../ui/use-layout-class.ts';
import { useReduceMotion } from '../ui/use-reduce-motion.ts';
import { useTheme } from '../ui/theme.tsx';
import { PagerPages, SEARCH_TAB, usePagerShell } from './pager-shell.tsx';
import {
  innerHorizontalTouched,
  resetInnerHorizontal,
  setRootTab,
  useRootTab,
} from './root-tab.ts';
import {
  dragOffset,
  inEdgeDeadZone,
  isHorizontalIntent,
  pageOffset,
  perMs,
  shouldClaimSwipe,
  snapTarget,
  TAB_COUNT,
} from './tab-pager-math.ts';

/** Stiff, critically damped spring: carries the release velocity, never overshoots. */
const SPRING = { stiffness: 320, damping: 36, mass: 1, overshootClamping: true } as const;

export function RootTabsPager(): ReactNode {
  const { colors } = useTheme();
  const index = useRootTab();
  const rail = usesRail(useLayoutClass());
  const reduced = useReduceMotion();
  const [width, setWidth] = useState(() => Dimensions.get('window').width);
  const shell = usePagerShell(index);

  // UI-thread mirrors of what the worklets read.
  const x = useSharedValue(pageOffset(index, width));
  const at = useSharedValue(index);
  const w = useSharedValue(width);
  const instant = useSharedValue(rail || reduced);
  const inner = useSharedValue(false);
  const start = useSharedValue({ x: 0, y: 0 });
  useEffect(() => {
    at.value = index;
    w.value = width;
    instant.value = rail || reduced;
  }, [at, w, instant, index, width, rail, reduced]);

  // Every index change (tab bar, rail, deep link, back, or a swipe's commit) settles from here.
  const prev = useRef({ index, width });
  useEffect(() => {
    const resized = prev.current.width !== width;
    const left = prev.current.index;
    prev.current = { index, width };
    shell.mount(index);
    const target = pageOffset(index, width);
    if (resized || rail || reduced) x.value = target;
    else if (x.value !== target) x.value = withSpring(target, SPRING);
    if (left === index) return;
    resetHeaderScrolled();
    if (left === SEARCH_TAB) Keyboard.dismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared values + stable setters
  }, [index, width]);

  const commit = (target: number): void => setRootTab(target);
  const reveal = (i: number): void => shell.mountAround(i);

  const pan = usePanGesture({
    enabled: !rail,
    manualActivation: true,
    onTouchesDown: (e) => {
      'worklet';
      const t = e.allTouches[0];
      if (t) start.value = { x: t.x, y: t.y };
    },
    onTouchesMove: (e) => {
      'worklet';
      const t = e.allTouches[0];
      if (!t || e.numberOfTouches > 1 || inner.value) return GestureStateManager.fail(e.handlerTag);
      const dx = t.x - start.value.x;
      const dy = t.y - start.value.y;
      if (inEdgeDeadZone(start.value.x, w.value)) return GestureStateManager.fail(e.handlerTag);
      if (shouldClaimSwipe(start.value.x, dx, dy, w.value))
        return GestureStateManager.activate(e.handlerTag);
      // Clearly vertical: let the list scroll.
      if (Math.abs(dy) > 16 && !isHorizontalIntent(dx, dy)) GestureStateManager.fail(e.handlerTag);
    },
    onActivate: () => {
      'worklet';
      cancelAnimation(x);
      scheduleOnRN(reveal, at.value);
    },
    onUpdate: (e) => {
      'worklet';
      x.value = dragOffset(at.value, e.translationX, w.value);
    },
    onDeactivate: (e) => {
      'worklet';
      const target = e.canceled
        ? at.value
        : snapTarget(at.value, e.translationX, perMs(e.velocityX), w.value);
      const to = pageOffset(target, w.value);
      // Animate first, then commit: the spring is already running before React re-renders.
      x.value = instant.value ? to : withSpring(to, { ...SPRING, velocity: e.velocityX });
      if (target !== at.value) {
        at.value = target;
        scheduleOnRN(commit, target);
      }
    },
  });

  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <GestureDetector gesture={pan}>
      <View
        style={[styles.viewport, { backgroundColor: colors.canvas }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onTouchStartCapture={() => {
          resetInnerHorizontal();
          inner.value = false;
        }}
        onTouchMove={() => {
          if (innerHorizontalTouched()) inner.value = true;
        }}
        testID="root-tabs-pager"
      >
        <Animated.View style={[styles.row, { width: width * TAB_COUNT }, row]}>
          <PagerPages index={index} width={width} mounted={shell.mounted} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  row: { flex: 1, flexDirection: 'row' },
});
