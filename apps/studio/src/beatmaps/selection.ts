import { create } from 'zustand';

/** The beatmap open in the Beatmaps workspace, so a Rhythm block can open its own. */
export const useBeatmapPick = create<{
  readonly id: string | null;
  readonly pick: (id: string | null) => void;
}>((set) => ({
  id: null,
  pick: (id) => set({ id }),
}));
