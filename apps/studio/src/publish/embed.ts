import type { StoryProject, Track } from '@ie/story';

/*
 * A novel file for the Player carries its imported songs (ADR 0032): the Studio keeps them in
 * OPFS, which the Player can't read, so each file track becomes a data: URL track under the same
 * id. Music blocks, fights and sequences name tracks by id, so nothing else changes.
 */

/** Reads a stored file, or undefined when this device doesn't have it. */
export type ReadFile = (path: string) => Promise<Blob | undefined>;

export interface Embedded {
  readonly doc: StoryProject;
  /** File tracks whose audio isn't on this device; they stay as they were and play nothing. */
  readonly missing: readonly string[];
  readonly bytes: number;
}

/** The blob as a data: URL, without FileReader (so it runs in tests too). */
export async function dataUrl(blob: Blob, mime: string): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(binary)}`;
}

export async function embedSongs(doc: StoryProject, read: ReadFile): Promise<Embedded> {
  const tracks = doc.audio?.tracks ?? [];
  if (!tracks.some((t) => t.source.kind === 'file')) return { doc, missing: [], bytes: 0 };
  const missing: string[] = [];
  let bytes = 0;
  const out: Track[] = [];
  for (const track of tracks) {
    if (track.source.kind !== 'file') {
      out.push(track);
      continue;
    }
    const blob = await read(track.source.path);
    if (!blob) {
      missing.push(track.title || track.id);
      out.push(track);
      continue;
    }
    bytes += blob.size;
    const mime = track.source.mime || blob.type || 'audio/mpeg';
    out.push({ ...track, source: { kind: 'url', url: await dataUrl(blob, mime) } });
  }
  return {
    doc: { ...doc, audio: { ...(doc.audio ?? { sounds: [] }), tracks: out } },
    missing,
    bytes,
  };
}
