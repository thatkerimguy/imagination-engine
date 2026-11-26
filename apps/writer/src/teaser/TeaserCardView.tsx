// The 9:16 teaser card as a React Native view, laid out at the full 1080×1920 logical size so the
// native capture (react-native-view-shot) and the scaled on-screen preview are the same tree.
import { forwardRef, type ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { serif, sans } from '../ui/type.ts';
import type { CardRef } from './teaser-types.ts';
import { getTeaserPreset, quoteLayout, TEASER_SIZE, type TeaserCard } from './teaser-model.ts';

export const TeaserCardView = forwardRef<CardRef, { card: TeaserCard }>(function TeaserCardView(
  { card },
  ref,
): ReactNode {
  const p = getTeaserPreset(card.preset);
  const { fontSize, lineHeight } = quoteLayout(card.quote.length);
  const face = p.serif ? serif : sans;
  return (
    <View
      ref={ref}
      collapsable={false}
      testID="teaser-card"
      style={[
        styles.card,
        { backgroundColor: p.background },
        p.glow ? { borderColor: p.glow, borderWidth: 8 } : null,
      ]}
    >
      {card.badge ? (
        <View style={[styles.badge, { backgroundColor: card.accent }]}>
          <Text style={[styles.badgeText, { color: p.background, fontFamily: sans }]}>
            {card.badge}
          </Text>
        </View>
      ) : null}
      <View style={styles.center}>
        <View style={[styles.rule, { backgroundColor: card.accent }]} />
        <Text style={{ color: p.text, fontFamily: face, fontSize, lineHeight }}>{card.quote}</Text>
      </View>
      <View style={styles.footer}>
        <View style={styles.titles}>
          <Text numberOfLines={2} style={[styles.book, { color: p.muted, fontFamily: face }]}>
            {card.bookTitle}
          </Text>
          <Text numberOfLines={2} style={[styles.chapter, { color: p.muted, fontFamily: face }]}>
            {card.chapterTitle}
          </Text>
        </View>
        {card.showCover && card.coverUri ? (
          <Image source={{ uri: card.coverUri }} style={styles.cover} resizeMode="cover" />
        ) : null}
      </View>
    </View>
  );
});

const PAD = 96;
const styles = StyleSheet.create({
  card: {
    width: TEASER_SIZE.width,
    height: TEASER_SIZE.height,
    paddingHorizontal: PAD,
    paddingTop: 160,
    paddingBottom: 200,
  },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 24, paddingVertical: 14 },
  badgeText: { fontSize: 30, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', gap: 48 },
  rule: { width: 120, height: 8 },
  footer: { flexDirection: 'row', alignItems: 'flex-end', gap: 32 },
  titles: { flex: 1, gap: 8 },
  book: { fontSize: 40, fontWeight: '600' },
  chapter: { fontSize: 34 },
  cover: { width: 160, height: 240 },
});
