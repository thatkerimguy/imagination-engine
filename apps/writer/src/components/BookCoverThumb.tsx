// Folio book cover: a 44×62 `surface` page with a 4px spine in the novel's accent and a serif
// monogram of the title — or the book's cover art, via its cached 240 × 360 thumbnail.
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt } from '../ui/Txt.tsx';
import { radius } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { CoverImage } from './CoverImage.tsx';

export function BookCoverThumb({
  title,
  accent,
  coverUri,
}: {
  title: string;
  /** Spine colour; defaults to the app accent. */
  accent?: string;
  /** Cover art; the cached `.thumb.jpg` is preferred. */
  coverUri?: string;
}): ReactNode {
  const { colors } = useTheme();
  const [failed, setFailed] = useState<string | null>(null);
  const art = coverUri && failed !== coverUri ? coverUri : null;
  return (
    <View
      style={[styles.page, { backgroundColor: colors.surface, borderColor: colors.hairline }]}
      accessible={false}
    >
      {art ? (
        <CoverImage uri={art} style={StyleSheet.absoluteFill} onFail={() => setFailed(art)} />
      ) : (
        <Txt variant="heading" style={styles.mono}>
          {(title.trim()[0] ?? '?').toUpperCase()}
        </Txt>
      )}
      <View style={[styles.spine, { backgroundColor: accent ?? colors.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    width: 44,
    height: 62,
    borderRadius: radius.xs,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  mono: { marginLeft: 4 },
});
