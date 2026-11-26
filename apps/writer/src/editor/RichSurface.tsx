// Native prose-run surface. Picks, once per mount, the enriched native editor for runs it can
// round-trip byte-for-byte, and the plain live input otherwise (highlights, colours, comments,
// wikilinks, escapes), so the Author's source is never rewritten. Landscape always uses the plain
// input: it sets `disableFullscreenUI`, which the enriched EditText does not expose (Gate 3 C4).
import { useState, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { EnrichedSurface } from './EnrichedSurface.tsx';
import { isEnrichedSafe } from './markdown-bridge.ts';
import { PlainSurface } from './PlainSurface.tsx';
import type { RichSurfaceProps } from './rich-surface-types.ts';

/** Compatibility kill switch: `false` routes every run to the plain surface. */
export const ENRICHED_SURFACE_ENABLED = true;

const WRITER_ONLY = /==|\{/;

export function RichSurface(p: RichSurfaceProps): ReactNode {
  const { width, height } = useWindowDimensions();
  const portrait = height >= width;
  const [enriched] = useState(() => ENRICHED_SURFACE_ENABLED && isEnrichedSafe(p.value));
  // A toolbar highlight / colour / comment the native editor cannot show hands the run over to the
  // plain input, focused, so the Author keeps typing.
  const handedOver = enriched && WRITER_ONLY.test(p.value);
  if (enriched && portrait && !handedOver) return <EnrichedSurface {...p} />;
  return <PlainSurface {...p} autoFocus={p.autoFocus || handedOver} />;
}
