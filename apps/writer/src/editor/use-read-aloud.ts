// React binding for read aloud. Speech is ALWAYS stopped on unmount, screen blur and whenever the
// app leaves the foreground, so the phone never keeps talking behind another screen or app.
import type { Block } from '@kn/core';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  createReadAloud,
  speakableSegments,
  type ReadAloud,
  type ReadSegment,
  type ReadState,
} from './read-aloud.ts';
import { speechAdapter } from './speech-adapter.ts';

export interface UseReadAloud {
  state: ReadState;
  available: boolean;
  segments: ReadSegment[];
  controller: ReadAloud;
}

export function useReadAloud(
  blocks: readonly Block[],
  onActiveBlock?: (blockIndex: number) => void,
): UseReadAloud {
  const segments = useMemo(() => speakableSegments(blocks), [blocks]);
  const controller = useMemo(() => createReadAloud(speechAdapter, []), []);
  const [state, setState] = useState<ReadState>(controller.getState());
  const segRef = useRef(segments);
  const cbRef = useRef(onActiveBlock);
  cbRef.current = onActiveBlock;
  segRef.current = segments;

  useEffect(() => {
    const off = controller.onChange((s) => {
      setState(s);
      const seg = segRef.current[s.index];
      if (s.status !== 'idle' && seg) cbRef.current?.(seg.blockIndex);
    });
    return () => {
      off();
      controller.stop();
    };
  }, [controller]);

  useEffect(() => controller.setSegments(segments), [controller, segments]);

  useFocusEffect(useCallback(() => () => controller.stop(), [controller]));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') controller.stop();
    });
    return () => sub.remove();
  }, [controller]);

  return { state, available: speechAdapter.available(), segments, controller };
}
