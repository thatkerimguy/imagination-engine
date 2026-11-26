// Metrics ribbon collapse state: the Author's toggle plus the compact-landscape IME auto-collapse.
import { useCallback, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { shouldAutoCollapseMetrics } from './landscape-chrome.ts';
import { useWebIme } from './use-web-ime';

export function useRibbonCollapse(keyboardOpen: boolean) {
  const { width, height } = useWindowDimensions();
  const webIme = useWebIme();
  const [userCollapsed, setUserCollapsed] = useState(false);
  const toggle = useCallback(() => setUserCollapsed((c) => !c), []);
  const collapsed = shouldAutoCollapseMetrics({
    windowWidth: width,
    windowHeight: height,
    keyboardVisible: keyboardOpen || webIme,
    userCollapsed,
  });
  return { collapsed, toggle };
}
