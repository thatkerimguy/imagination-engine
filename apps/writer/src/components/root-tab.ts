// The root shell's active tab (0 Library · 1 Notes · 2 Search) as a tiny external store, shared by
// RootTabsPager, FolioTabBar, FolioNavRail and the `/folders` + `/search` deep-link routes.
import { useSyncExternalStore } from 'react';
import { TAB_ROOTS, type TabKey } from '../routes.ts';
import { clampIndex } from './tab-pager-math.ts';

let current = 0;
const listeners = new Set<() => void>();

export const getRootTab = (): number => current;

export function setRootTab(index: number): void {
  const next = clampIndex(index);
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const useRootTab = (): number => useSyncExternalStore(subscribe, getRootTab, getRootTab);

export const tabIndexOf = (key: TabKey): number => TAB_ROOTS.findIndex((t) => t.key === key);
export const tabKeyAt = (index: number): TabKey => TAB_ROOTS[clampIndex(index)]!.key;

// An inner horizontal scroller (RecentStrip) marks the touch it owns, so the pager never turns a
// carousel drag into a tab switch. The pager clears the mark at the start of every touch.
let innerHorizontal = false;
export const claimInnerHorizontal = (): void => {
  innerHorizontal = true;
};
export const resetInnerHorizontal = (): void => {
  innerHorizontal = false;
};
export const innerHorizontalTouched = (): boolean => innerHorizontal;
