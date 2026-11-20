// Native emergency snapshots: rotating `.zip` files in `Paths.document/backups` (latest 5 kept).
import { Directory, File, Paths } from 'expo-file-system';

export const SNAPSHOTS_KEPT = 5;

/** Writes a snapshot and prunes older ones. Returns true when written. */
export async function writeSnapshot(bytes: Uint8Array, now: number): Promise<boolean> {
  const dir = new Directory(Paths.document, 'backups');
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(dir, `emergency-${String(now).padStart(14, '0')}.zip`);
  if (file.exists) file.delete();
  file.create();
  await file.write(bytes);
  const old = dir
    .list()
    .filter((f): f is File => f instanceof File && /^emergency-\d+\.zip$/.test(f.name))
    .sort((a, b) => b.name.localeCompare(a.name))
    .slice(SNAPSHOTS_KEPT);
  for (const f of old) f.delete();
  return true;
}
