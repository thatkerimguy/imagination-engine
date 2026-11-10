import { create } from 'zustand';

/** An output picked by a first tap, waiting for the input to link it to (tap to connect). */
export interface ArmedPort {
  readonly node: string;
  readonly port: string;
}

/** What the Materials workspace has open; not part of the project, so not undone. */
export interface MaterialUi {
  readonly materialId: string | null;
  readonly selected: string | null;
  readonly armed: ArmedPort | null;
  open: (materialId: string | null) => void;
  select: (id: string | null) => void;
  arm: (port: ArmedPort | null) => void;
}

export const useMaterialUi = create<MaterialUi>()((set) => ({
  materialId: null,
  selected: null,
  armed: null,
  open: (materialId) => set({ materialId, selected: null, armed: null }),
  select: (selected) => set({ selected }),
  arm: (armed) => set({ armed }),
}));
