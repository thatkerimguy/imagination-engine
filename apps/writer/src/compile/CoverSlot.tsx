// A miniature 2:3 cover on the print-shop desk; tap to choose art.
import type { ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { BookCoverThumb } from '../components/BookCoverThumb.tsx';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { lift, radius, space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';

export function CoverSlot(p: {
  title: string;
  author: string;
  subtitle?: string;
  coverUri?: string;
  onPress(): void;
}): ReactNode {
  const { colors, dark } = useTheme();
  return (
    <View style={styles.row}>
      <Press
        accessibilityRole="button"
        accessibilityLabel={p.coverUri ? 'Change cover' : 'Add cover'}
        onPress={p.onPress}
        testID="compile-cover"
        style={[
          styles.cover,
          lift(dark),
          { backgroundColor: colors.surface, borderColor: colors.hairline },
        ]}
      >
        {p.coverUri ? (
          <Image source={{ uri: p.coverUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={styles.empty}>
            <BookCoverThumb title={p.title} />
            <Txt variant="caption" color="inkMuted">
              Add cover
            </Txt>
          </View>
        )}
      </Press>
      <View style={styles.text}>
        <Txt variant="title" numberOfLines={3} accessibilityRole="header">
          {p.title}
        </Txt>
        {p.subtitle ? (
          <Txt variant="body" color="inkSecondary" style={styles.italic}>
            {p.subtitle}
          </Txt>
        ) : null}
        {p.author ? (
          <Txt variant="overline" color="inkSecondary">
            {p.author}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-end', paddingTop: space.xs },
  cover: {
    width: 96,
    height: 144,
    borderRadius: radius.xs,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', gap: space.xs },
  text: { flex: 1, gap: space.xxs, paddingBottom: space.xxs },
  italic: { fontStyle: 'italic' },
});
