// The web build has no Storage Access Framework: external folder mirroring is Android-only.
export const SAF_SUPPORTED = false;

export interface SafFolder {
  uri: string;
  label: string;
}

export async function pickSafFolder(): Promise<SafFolder | null> {
  return null;
}

/** No-op: no folder can be connected on web. */
export async function mirrorToSaf(): Promise<string | null> {
  return null;
}
