// Shared plumbing of both RootTabsPager builds (native UI-thread and web): the three root pages,
// lazy mounting with an idle warm-up of the neighbours, Android back unwinding (Notes / Search →
// Library → exit) and the page row markup with its accessibility hiding.
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { LibraryView } from '../library/LibraryView.tsx';
import { NotesWorkspace } from '../notes/NotesWorkspace.tsx';
import { SearchView } from '../search/SearchView.tsx';
import { runAfterInteractions } from '../ui/after-interactions.ts';
import { PageActiveContext } from '../ui/ScreenOptions.tsx';
import { useBackIntercept } from '../ui/use-back-intercept.ts';
import { setRootTab } from './root-tab.ts';
import { clampIndex, rootBackTarget } from './tab-pager-math.ts';

export const SEARCH_TAB = 2;
/** Neighbouring tabs mount this long after the first idle, so the first swipe never hitches. */
const WARM_MS = 1200;

// Created once: React reuses identical elements, so switching tabs never re-renders the pages.
const PAGES: readonly ReactNode[] = [
  <LibraryView key="library" />,
  <NotesWorkspace key="notes" folderId={null} />,
  <SearchView key="search" />,
];

/** Which pages are mounted, plus `mountAround(i)` for the tabs a drag may reveal. */
export function usePagerShell(index: number) {
  const [mounted, setMounted] = useState<ReadonlySet<number>>(() => new Set([index]));
  const mount = (...ids: number[]): void =>
    setMounted((m) => (ids.every((i) => m.has(i)) ? m : new Set([...m, ...ids])));
  const mountAround = (i: number): void => mount(clampIndex(i - 1), clampIndex(i + 1));

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

  useBackIntercept([{ open: index !== 0, close: () => setRootTab(rootBackTarget(index) ?? 0) }]);
  return { mounted, mount, mountAround };
}

/** The page row's children: one full-width slot per tab, inactive ones hidden from a11y. */
export function PagerPages(p: {
  index: number;
  width: number;
  mounted: ReadonlySet<number>;
}): ReactNode {
  return PAGES.map((page, i) => {
    const active = i === p.index;
    return (
      <View
        key={i}
        style={{ width: p.width }}
        aria-hidden={!active}
        importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!active}
        testID={`root-page-${i}`}
      >
        <PageActiveContext.Provider value={active}>
          {p.mounted.has(i) ? page : null}
        </PageActiveContext.Provider>
      </View>
    );
  });
}
