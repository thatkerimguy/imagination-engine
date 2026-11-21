// Stable collapse handler for the formatting toolbar halves (keeps the memoized toolbar quiet).
import { useCallback } from 'react';
import type { ToolbarHalf } from '../editor/ToolbarCollapse.tsx';
import { useWriterPrefs } from './theme.tsx';

export function useToolbarCollapse(): (half: ToolbarHalf, collapsed: boolean) => void {
  const [, setPrefs] = useWriterPrefs();
  return useCallback(
    (half, collapsed) =>
      setPrefs(
        half === 'format'
          ? { toolbarFormatCollapsed: collapsed }
          : { toolbarAddCollapsed: collapsed },
      ),
    [setPrefs],
  );
}
