// Folio book cover: a 44×62 `surface` page with a 4px spine in the novel's accent and a serif
// monogram of the title.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt } from '../ui/Txt.tsx';
import { radius } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';

export function BookCoverThumb({
  title,
  accent,
}: {
  title: string;
  /** Spine colour; defaults to the app accent. */
  accent?: string;
}): ReactNode {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.page, { backgroundColor: colors.surface, borderColor: colors.hairline }]}
      accessible={false}
    >
      <View style={[styles.spine, { backgroundColor: accent ?? colors.accent }]} />
      <Txt variant="heading" style={styles.mono}>
        {(title.trim()[0] ?? '?').toUpperCase()}
      </Txt>
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
