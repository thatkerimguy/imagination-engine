// CONTRACT STUB (Phase A) — Worker 3 replaces the implementation; keep these exported signatures.
import { proseFont } from '../ui/m3-tokens.ts';

/**
 * The fontFamily to render for a font id (catalog preset or `custom-font-<ulid>`). Starts the lazy
 * load on first use and returns a system fallback until the face is ready.
 */
export function useFontFamily(fontId: string): string {
  void fontId;
  return proseFont;
}
