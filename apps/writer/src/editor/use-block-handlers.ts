// Stable, id-taking block handlers for the Chapter Editor (via a ref to the latest actions, so
// memoized BlockViews skip renders), block offsets, `jump` and the one-shot deep-link jump.
import { useCallback, useEffect, useRef, type ComponentRef, type RefObject } from 'react';
import type { Block } from '@kn/core';
import type { ScrollView } from 'react-native';
import { space } from '../ui/tokens.ts';
import type { useEditorActions } from './use-editor-actions.ts';

type Actions = ReturnType<typeof useEditorActions>;

export function useBlockHandlers(
  a: Actions,
  scroller: RefObject<ComponentRef<typeof ScrollView> | null>,
  initialBlockId: string | undefined,
) {
  const offsets = useRef(new Map<string, number>());
  const actions = useRef(a);
  actions.current = a;
  const onChange = useCallback((b: Block) => actions.current.change(b), []);
  const onToggleBeat = useCallback((id: string) => actions.current.toggleBeat(id), []);
  const onMove = useCallback((id: string, d: -1 | 1) => actions.current.move(id, d), []);
  const onDelete = useCallback((id: string) => void actions.current.remove(id), []);
  const onOpenGimmick = useCallback((id: string) => actions.current.openSheet(id), []);
  const onSelect = useCallback((id: string) => actions.current.select(id), []);
  const onLayout = useCallback((id: string, y: number) => void offsets.current.set(id, y), []);
  const jump = useCallback(
    (id: string): void => {
      actions.current.select(id);
      const y = offsets.current.get(id);
      if (y !== undefined)
        scroller.current?.scrollTo({ y: Math.max(0, y - space.xl), animated: true });
    },
    [scroller],
  );

  useEffect(() => {
    if (!initialBlockId) return;
    const t = setTimeout(() => jump(initialBlockId), 350);
    return () => clearTimeout(t);
    // Only on open: a deep link jumps once.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { onChange, onToggleBeat, onMove, onDelete, onOpenGimmick, onSelect, onLayout, jump };
}
