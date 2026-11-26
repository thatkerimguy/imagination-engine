// Routes formatting-toolbar marks to the focused prose run's native rich editor (when it owns
// formatting) and everything else to the block-level format actions; merges the native editor's
// live bold / italic / underline / strike state into the toolbar's active map.
import { useCallback, useRef, useState } from 'react';
import type { ToolId } from '../store/writer-prefs.ts';
import type { RunSegment } from './ProseRun.tsx';
import { NO_FORMATS, type ActiveFormats, type RichSurfaceHandle } from './rich-surface-types.ts';

const MARK_TOOLS: Partial<Record<ToolId, (h: RichSurfaceHandle) => void>> = {
  bold: (h) => h.toggleBold(),
  italic: (h) => h.toggleItalic(),
  underline: (h) => h.toggleUnderline(),
  strike: (h) => h.toggleStrike(),
};

export interface SurfaceTools {
  onHandle(runId: string, handle: RichSurfaceHandle | null): void;
  onFocusRun(runId: string): void;
  onActiveFormats(formats: ActiveFormats): void;
  /** UnifiedBlocks reports its latest runs here (to know which run holds the selection). */
  setRuns(runs: readonly RunSegment[]): void;
}

export function useSurfaceTools(input: {
  selectedId: string | null;
  onTool(id: ToolId): void;
  active: Partial<Record<ToolId, boolean>>;
}) {
  const handles = useRef(new Map<string, RichSurfaceHandle>());
  const runs = useRef<readonly RunSegment[]>([]);
  const [focusedRun, setFocusedRun] = useState<string | null>(null);
  const [formats, setFormats] = useState<ActiveFormats>(NO_FORMATS);

  const tools: SurfaceTools = {
    onHandle: useCallback((runId: string, h: RichSurfaceHandle | null) => {
      if (h) handles.current.set(runId, h);
      else handles.current.delete(runId);
    }, []),
    onFocusRun: useCallback((runId: string) => setFocusedRun(runId), []),
    onActiveFormats: useCallback((f: ActiveFormats) => setFormats(f), []),
    setRuns: useCallback((r: readonly RunSegment[]) => void (runs.current = r), []),
  };

  const run = runs.current.find((r) => r.id === focusedRun);
  const holds = !!run && input.selectedId !== null && run.blockIds.includes(input.selectedId);
  const handle = holds && focusedRun ? handles.current.get(focusedRun) : undefined;
  const native = !!handle?.native;

  const onTool = (id: ToolId): void => {
    const mark = MARK_TOOLS[id];
    if (native && handle && mark) return mark(handle);
    input.onTool(id);
  };
  const active = native ? { ...input.active, ...formats, strike: formats.strike } : input.active;
  return { tools, onTool, active };
}
