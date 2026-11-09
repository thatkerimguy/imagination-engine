import type { CompiledStory } from './compile.ts';
import type { Frame, Mutable, StoryState } from './state.ts';

/**
 * Fits a saved state to the story as it is now (ADR 0007), in place: frames whose block moved are
 * re-found by ID, and a waiting beat whose block is gone stops waiting. Returns the passage to
 * restart at when a block the state stood on is gone, or null when the state fits.
 */
export function reconcileState(story: CompiledStory, state: Mutable<StoryState>): string | null {
  const frames: Frame[] = [];
  for (const frame of state.frames) {
    if (frame.call) {
      frames.push(frame);
      continue;
    }
    const list = story.lists.get(frame.list);
    if (!list) return restartPassage(story, state);
    if (frame.at === undefined || list[frame.index - 1]?.id === frame.at) {
      frames.push(frame);
      continue;
    }
    const found = list.findIndex((b) => b.id === frame.at);
    if (found < 0) return restartPassage(story, state);
    frames.push({ ...frame, index: found + 1 });
  }
  state.frames = frames;
  const waiting = state.waiting === null ? null : state.log[state.waiting];
  if (waiting && 'blockId' in waiting && waiting.blockId && !story.blocks.has(waiting.blockId)) {
    state.waiting = null;
  }
  return null;
}

/** The passage the state was in (its outermost passage frame still in the story), or the start. */
function restartPassage(story: CompiledStory, state: StoryState): string {
  const passageFrame = state.frames.find((f) => f.list.startsWith('p:') && story.lists.has(f.list));
  return passageFrame?.list.slice(2) ?? story.project.start;
}
