// Book Visual DNA Studio: live preview, six preset cards and seven-axis fine tuning.
import {
  DNA_ARCHETYPE_IDS,
  DNA_ARCHETYPES,
  resolveVisualDna,
  type BookVisualDna,
} from '@kn/core/dna';
import { Stack } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider.tsx';
import type { StringKey } from '../i18n/i18n.ts';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Page, SectionLabel } from '../ui/Page.tsx';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { radius, space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { DnaAxes } from './dna-axes.tsx';
import { fontFamilyFor } from './dna-fonts.ts';
import { cloneDna, matchingArchetype, sameDna } from './dna-store.ts';
import { DnaPreviewCard } from './dna-preview.tsx';
import { useBookDna } from './use-book-dna.ts';

function PresetCard(p: {
  id: (typeof DNA_ARCHETYPE_IDS)[number];
  selected: boolean;
  onPick(): void;
}): ReactNode {
  const { t } = useI18n();
  const { colors } = useTheme();
  const dna = DNA_ARCHETYPES[p.id];
  const c = resolveVisualDna(dna, 'dark').colors;
  const name = t(`dna.arch.${p.id}` as StringKey);
  return (
    <Press
      accessibilityRole="radio"
      accessibilityLabel={name}
      accessibilityState={{ selected: p.selected }}
      testID={`dna-archetype-${p.id}`}
      onPress={p.onPick}
      wash={null}
      style={[
        styles.preset,
        {
          borderColor: p.selected ? colors.accent : colors.hairline,
          borderWidth: p.selected ? 2 : 1,
          backgroundColor: c['--dna-bg'],
        },
      ]}
    >
      <View style={styles.swatchRow}>
        {(['--dna-surface', '--dna-accent', '--dna-accent-2'] as const).map((k) => (
          <View
            key={k}
            style={[styles.swatch, { backgroundColor: c[k], borderColor: c['--dna-border'] }]}
          />
        ))}
      </View>
      <Txt
        color={c['--dna-ink'] as `#${string}`}
        numberOfLines={2}
        style={{
          fontFamily: fontFamilyFor(dna.typography.display),
          fontSize: 14,
          lineHeight: 18,
          flexShrink: 1,
        }}
      >
        {name}
      </Txt>
    </Press>
  );
}

export function DnaStudioScreen({ novelId }: { novelId: string }): ReactNode {
  const { t } = useI18n();
  const book = useBookDna(novelId);
  const [draft, setDraft] = useState<BookVisualDna | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (book.dna && !draft) setDraft(cloneDna(book.dna));
  }, [book.dna, draft]);
  if (!draft || !book.dna) return <Page />;
  const dirty = !sameDna(draft, book.dna);
  const archetype = matchingArchetype(draft);
  const edit = (next: BookVisualDna): void => {
    setSaved(false);
    setDraft(next);
  };
  const save = async (): Promise<void> => {
    await book.save(draft);
    setSaved(true);
  };
  return (
    <Page testID="dna-studio">
      <Stack.Screen
        options={{
          title: t('dna.title'),
          headerRight: () => (
            <ActionButton
              label={t('dna.save')}
              variant="ghost"
              disabled={!dirty}
              onPress={() => void save()}
              testID="dna-save"
            />
          ),
        }}
      />
      <SectionLabel>{t('dna.live')}</SectionLabel>
      <DnaPreviewCard dna={draft} />
      <Txt variant="meta" color="inkSecondary">
        {archetype ? t(`dna.arch.${archetype}` as StringKey) : t('dna.custom')}
      </Txt>
      <SectionLabel>{t('dna.presets')}</SectionLabel>
      <View style={styles.presets}>
        {DNA_ARCHETYPE_IDS.map((id) => (
          <PresetCard
            key={id}
            id={id}
            selected={archetype === id}
            onPick={() => edit(cloneDna(DNA_ARCHETYPES[id]))}
          />
        ))}
      </View>
      <SectionLabel>{t('dna.tuning')}</SectionLabel>
      <DnaAxes dna={draft} onChange={edit} />
      <ActionButton
        label={t('dna.save')}
        disabled={!dirty}
        onPress={() => void save()}
        testID="dna-save-bottom"
      />
      {saved ? (
        <Txt variant="body" color="accent">
          {t('dna.saved')}
        </Txt>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  preset: {
    width: '48%',
    flexGrow: 1,
    minHeight: 72,
    padding: space.xs,
    gap: 6,
    borderRadius: radius.md,
    justifyContent: 'space-between',
  },
  swatchRow: { flexDirection: 'row', gap: 4 },
  swatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 1 },
});
