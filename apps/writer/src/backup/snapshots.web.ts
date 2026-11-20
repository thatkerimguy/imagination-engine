// Expo Web has no private document directory: automatic snapshots are a no-op.
export async function writeSnapshot(): Promise<boolean> {
  return false;
}
