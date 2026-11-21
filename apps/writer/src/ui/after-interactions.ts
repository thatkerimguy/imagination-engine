// RN 0.88 removed `InteractionManager`; this is the minimal stand-in: run `task` once the current
// frame (tab switch / navigation transition) has painted, cancellable on unmount.
export function runAfterInteractions(task: () => void): { cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let frame: ReturnType<typeof requestAnimationFrame> | undefined;
  frame = requestAnimationFrame(() => {
    frame = undefined;
    timer = setTimeout(() => {
      timer = undefined;
      task();
    }, 60);
  });
  return {
    cancel() {
      if (frame !== undefined) cancelAnimationFrame(frame);
      if (timer !== undefined) clearTimeout(timer);
      frame = timer = undefined;
    },
  };
}
