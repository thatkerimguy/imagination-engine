// A cover image that prefers the cached 240 × 360 `.thumb.jpg` sidecar (small decoded bitmap)
// and falls back to the full cover when there is no thumbnail yet (legacy covers, web data URIs).
import { useState, type ReactNode } from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { thumbUriForCover } from '../media/cover-resize.ts';

export function CoverImage({
  uri,
  style,
  onFail,
}: {
  uri: string;
  style: StyleProp<ImageStyle>;
  /** Neither the thumbnail nor the cover could be loaded. */
  onFail?(): void;
}): ReactNode {
  const thumb = thumbUriForCover(uri);
  const [src, setSrc] = useState(thumb);
  const [shownFor, setShownFor] = useState(uri);
  if (shownFor !== uri) {
    setShownFor(uri);
    setSrc(thumb);
  }
  return (
    <Image
      source={{ uri: src }}
      style={style}
      resizeMode="cover"
      accessibilityIgnoresInvertColors
      onError={() => (src !== uri ? setSrc(uri) : onFail?.())}
    />
  );
}
