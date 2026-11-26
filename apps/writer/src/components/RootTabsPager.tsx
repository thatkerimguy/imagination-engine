// Root tab shell: Library · Notes · Search as one horizontal pager inside the `/` route, so a phone
// swipe follows the finger and springs to the neighbouring tab (Animated + PanResponder — no new
// native libraries). Compact windows only take the drag; on the rail layout (>= 600 dp) tab
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
import { LibraryView } from '../library/LibraryView.tsx';
import { NotesWorkspace } from '../notes/NotesWorkspace.tsx';
import { SearchView } from '../search/SearchView.tsx';
import { runAfterInteractions } from '../ui/after-interactions.ts';
import { resetHeaderScrolled } from '../ui/header-scroll.tsx';
import { usesRail } from '../ui/layout-class.ts';
import { PageActiveContext } from '../ui/ScreenOptions.tsx';
import { useBackIntercept } from '../ui/use-back-intercept.ts';
import { useLayoutClass } from '../ui/use-layout-class.ts';
import { useReduceMotion } from '../ui/use-reduce-motion.ts';
import { useTheme } from '../ui/theme.tsx';
import {
  innerHorizontalTouched,
  resetInnerHorizontal,
  setRootTab,
  useRootTab,
} from './root-tab.ts';
import {
  dragOffset,
  rootBackTarget,
  shouldClaimSwipe,
  snapTarget,
  TAB_COUNT,
} from './tab-pager-math.ts';

const NATIVE = Platform.OS !== 'web';
const SEARCH = 2;
/** Neighbouring tabs mount this long after the first idle, so the first swipe never hitches. */
const WARM_MS = 1200;

// Created once: React reuses identical elements, so switching tabs never re-renders the pages.
const PAGES: readonly ReactNode[] = [
  <LibraryView key="library" />,
  <NotesWorkspace key="notes" folderId={null} />,
  <SearchView key="search" />,
];
/** Stiff, critically damped spring: carries the release velocity, never overshoots. */
const SPRING = { stiffness: 320, damping: 36, mass: 1, overshootClamping: true } as const;

export function RootTabsPager(): ReactNode {
  const { colors } = useTheme();
  const index = useRootTab();
  const rail = usesRail(useLayoutClass());
  const reduced = useReduceMotion();
  const [width, setWidth] = useState(() => Dimensions.get('window').width);
  const x = useRef(new Animated.Value(-index * width)).current;
  const [mounted, setMounted] = useState<ReadonlySet<number>>(() => new Set([index]));
  const live = useRef({ index, width, rail, reduced });
  live.current = { index, width, rail, reduced };

  const mount = (...ids: number[]): void =>
    setMounted((m) => (ids.every((i) => m.has(i)) ? m : new Set([...m, ...ids])));

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

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handle = runAfterInteractions(() => {
      timer = setTimeout(() => mount(...PAGES.map((_, i) => i)), WARM_MS);
    });
    return () => {
      handle.cancel();
      if (timer) clearTimeout(timer);
    };
  }, []);

  useBackIntercept([
    {
      open: index !== 0,
      close: () => setRootTab(rootBackTarget(index) ?? 0),
    },
  ]);

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
          const i = live.current.index;
          mount(Math.max(0, i - 1), Math.min(TAB_COUNT - 1, i + 1));
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
        {PAGES.map((page, i) => {
          const active = i === index;
          return (
            <View
              key={i}
              style={{ width }}
              aria-hidden={!active}
              importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
              accessibilityElementsHidden={!active}
              testID={`root-page-${i}`}
            >
              <PageActiveContext.Provider value={active}>
                {mounted.has(i) ? page : null}
              </PageActiveContext.Provider>
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden' },
  row: { flex: 1, flexDirection: 'row' },
});
