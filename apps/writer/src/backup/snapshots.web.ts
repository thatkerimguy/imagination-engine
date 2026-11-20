// Expo Web has no private document directory: automatic snapshots are a no-op.
export async function writeSnapshot(_bytes: Uint8Array, _now: number): Promise<boolean> {
  return false;
}
