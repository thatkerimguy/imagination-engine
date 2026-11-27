// Compact horizontal chapter chips above the quote picker (novel-level teasers, 2+ chapters).
// Lives inside a Sheet, not the root tab pager, so it needs no `claimInnerHorizontal`.
import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { MIN_TOUCH } from '../ui/a11y.ts';
import { Press } from '../ui/Press.tsx';
import { radius, space } from '../ui/tokens.ts';
import { Txt } from '../ui/Txt.tsx';
import { useTheme } from '../ui/theme.tsx';
import type { TeaserChapterChoice } from './teaser-model.ts';

export function TeaserChapterStrip(p: {
  choices: readonly TeaserChapterChoice[];
  activeId: string | undefined;
  onPick(id: string): void;
}): ReactNode {
  const { t } = useI18n();
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.xs }}
      accessibilityLabel={t('teaser.chapter')}
      testID="teaser-chapter-strip"
    >
      {p.choices.map((c) => {
        const on = c.id === p.activeId;
        return (
          <Press
            key={c.id}
            onPress={() => p.onPick(c.id)}
            accessibilityRole="button"
            accessibilityLabel={t('teaser.useChapter', { title: c.title })}
            accessibilityState={{ selected: on }}
            testID={`teaser-chapter-${c.id}`}
            style={{
              minHeight: MIN_TOUCH,
              maxWidth: 200,
              justifyContent: 'center',
              paddingHorizontal: space.sm,
              borderRadius: radius.sm,
              borderWidth: 1,
              borderColor: on ? colors.accent : colors.hairline,
            }}
          >
            <Txt variant="meta" color={on ? 'accent' : 'inkSecondary'} numberOfLines={1}>
              {c.title || t('teaser.chapter')}
            </Txt>
          </Press>
        );
      })}
    </ScrollView>
  );
}
