// "Create 9:16 teaser": pick a pull-quote and a look, preview the card, export a 1080×1920 PNG or
// open the 9:16 Record Frame (Live Preview) for screen-recording the gimmick.
import type { ChapterDocument } from '@kn/core';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { routes } from '../routes.ts';
import { maybeRequestReview } from '../settings/review-request';
import { useRepository } from '../store/context.tsx';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Field } from '../ui/Field.tsx';
import { Press } from '../ui/Press.tsx';
import { SegmentControl, type SegmentOption } from '../ui/SegmentControl.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { Toggle } from '../ui/Toggle.tsx';
import { space } from '../ui/tokens.ts';
import { Txt } from '../ui/Txt.tsx';
import { useTheme } from '../ui/theme.tsx';
import { TeaserCardView } from './TeaserCardView.tsx';
import { exportTeaserPng } from './teaser-export';
import {
  clampQuote,
  extractQuoteCandidates,
  gimmickBadge,
  MAX_QUOTE_CHARS,
  TEASER_PRESETS,
  TEASER_SIZE,
  type TeaserCard,
  type TeaserPresetId,
} from './teaser-model.ts';
import type { CardRef } from './teaser-types.ts';
import { useTeaserSource } from './use-teaser-source.ts';

export interface TeaserSheetProps {
  visible: boolean;
  /** Defaults to the route's `novelId` param (the Chapter Editor). */
  novelId?: string;
  /** The open chapter; the Outline omits it and the first quotable chapter is used. */
  chapter?: ChapterDocument;
  onClose(): void;
}

export function TeaserSheet(p: TeaserSheetProps): ReactNode {
  const { t } = useI18n();
  const { colors } = useTheme();
  const repo = useRepository();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ novelId?: string }>();
  const novelId = p.novelId ?? params.novelId ?? '';
  const source = useTeaserSource(p.visible, novelId, p.chapter);
  const chapter = source?.chapter ?? null;
  const candidates = useMemo(
    () => (chapter ? extractQuoteCandidates(chapter.blocks) : []),
    [chapter],
  );
  const [preset, setPreset] = useState<TeaserPresetId>('midnight-ink');
  const [quote, setQuote] = useState('');
  const [showCover, setShowCover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const cardRef = useRef<CardRef>(null);
  const seeded = useRef<string | null>(null);
  useEffect(() => {
    const key = chapter?.id ?? null;
    if (key && seeded.current !== key) {
      seeded.current = key;
      setQuote(candidates[0] ?? '');
    }
  }, [chapter, candidates]);

  const card: TeaserCard = {
    quote: clampQuote(quote),
    bookTitle: source?.bookTitle ?? '',
    chapterTitle: chapter?.title ?? '',
    accent: source?.accent ?? colors.accent,
    preset,
    showCover,
    ...(chapter && gimmickBadge(chapter.blocks) ? { badge: gimmickBadge(chapter.blocks)! } : {}),
    ...(source?.coverUri ? { coverUri: source.coverUri } : {}),
  };
  const options: readonly SegmentOption<TeaserPresetId>[] = TEASER_PRESETS.map((x) => ({
    value: x.id,
    label: t(`teaser.preset.${x.id}`),
    testID: `teaser-preset-${x.id}`,
  }));
  const scale = Math.min(0.32, (width - space.md * 4) / TEASER_SIZE.width);

  const doExport = async (): Promise<void> => {
    setBusy(true);
    setNote(null);
    const stem = `${source?.bookTitle ?? 'novel'}-${chapter?.title ?? 'chapter'}`;
    const res = await exportTeaserPng({ card, stem, viewRef: cardRef });
    setBusy(false);
    if (!res.ok) return setNote({ text: res.message || t('teaser.failed'), error: true });
    if (res.status === 'saved') {
      setNote({ text: t('teaser.saved', { name: res.filename }), error: false });
      void maybeRequestReview(repo, 'teaser');
    }
  };
  const recordFrame = (): void => {
    if (!chapter) return;
    p.onClose();
    router.push(`${routes.preview(novelId, chapter.seasonId, chapter.id)}&record=9x16`);
  };

  return (
    <Sheet
      visible={p.visible}
      title={t('teaser.title')}
      subtitle={t('teaser.subtitle')}
      onClose={p.onClose}
      testID="teaser-studio"
    >
      <View style={{ gap: space.md }}>
        <View
          style={{
            alignSelf: 'center',
            width: TEASER_SIZE.width * scale,
            height: TEASER_SIZE.height * scale,
            overflow: 'hidden',
          }}
        >
          <View style={{ transform: [{ scale }], transformOrigin: 'top left' }}>
            <TeaserCardView ref={cardRef} card={card} />
          </View>
        </View>
        <SegmentControl<TeaserPresetId>
          options={options}
          value={preset}
          onChange={setPreset}
          accessibilityLabel={t('teaser.style')}
          testID="teaser-preset"
        />
        <Txt variant="label" color="inkSecondary">
          {candidates.length ? t('teaser.pick') : t('teaser.noProse')}
        </Txt>
        {candidates.map((c, i) => (
          <Press
            key={c}
            onPress={() => setQuote(c)}
            accessibilityRole="button"
            accessibilityLabel={c}
            testID={`teaser-candidate-${i}`}
            style={{ paddingVertical: space.xxs }}
          >
            <Txt variant="meta" color={c === quote ? 'accent' : 'inkSecondary'} numberOfLines={3}>
              {c}
            </Txt>
          </Press>
        ))}
        <Field
          label={t('teaser.quoteLabel')}
          value={quote}
          onChangeText={setQuote}
          multiline
          maxLength={MAX_QUOTE_CHARS}
          trailingHint={`${quote.length}/${MAX_QUOTE_CHARS}`}
          testID="teaser-quote-input"
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Txt variant="body" style={{ flex: 1 }}>
            {t('teaser.cover')}
          </Txt>
          <Toggle
            value={showCover}
            onValueChange={setShowCover}
            disabled={!source?.coverUri}
            accessibilityLabel={t('teaser.cover')}
            testID="teaser-cover-toggle"
          />
        </View>
        {note ? (
          <Txt
            variant="meta"
            color={note.error ? 'danger' : 'inkSecondary'}
            accessibilityLiveRegion="polite"
            testID="teaser-note"
          >
            {note.text}
          </Txt>
        ) : null}
        <ActionButton
          icon="download"
          label={busy ? t('teaser.exporting') : t('teaser.exportPng')}
          disabled={busy || !card.quote}
          onPress={() => void doExport()}
          testID="teaser-export-png"
        />
        <ActionButton
          variant="secondary"
          icon="video"
          label={t('teaser.recordFrame')}
          disabled={!chapter}
          onPress={recordFrame}
          testID="teaser-record-frame"
        />
        <Txt variant="meta" color="inkMuted">
          {t('teaser.recordHint')}
        </Txt>
      </View>
    </Sheet>
  );
}
