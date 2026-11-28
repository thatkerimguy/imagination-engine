// Live Visual DNA. `dna-apply.ts` dispatches `kn:dna-change` on window whenever a reading root's
// DNA is (re-)resolved: a Light/Dark/Book theme flip or a new DNA pushed by the writer preview.
// Every mounted runtime context following that root updates `ctx.dna` and fires `onDnaChange`.
import type { ResolvedVisualDna } from '@kn/core/dna';

export const DNA_EVENT = 'kn:dna-change';

export interface DnaChange {
  root: HTMLElement;
  dna: ResolvedVisualDna;
}

export function dispatchDnaChange(root: HTMLElement, dna: ResolvedVisualDna): void {
  window.dispatchEvent(new CustomEvent<DnaChange>(DNA_EVENT, { detail: { root, dna } }));
}
