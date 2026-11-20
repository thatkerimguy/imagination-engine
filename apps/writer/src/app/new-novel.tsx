// New novel form: title and author are required; the book starts with one season and chapter.
import type { SectionLabel } from '@kn/core';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { SECTION_LABELS } from '../library/section-labels.ts';
import { routes } from '../routes.ts';
import { useRepository } from '../store/context.tsx';
import { AppText } from '../ui/AppText.tsx';
import { Button } from '../ui/Button.tsx';
import { Screen, SectionTitle } from '../ui/layout.tsx';
import { SegmentedButtons, type Segment } from '../ui/SegmentedButtons.tsx';
import { TextField } from '../ui/TextField.tsx';

const SEGMENTS: readonly Segment<SectionLabel>[] = SECTION_LABELS.map((l) => ({
  value: l,
  label: l,
}));

export default function NewNovelScreen(): ReactNode {
  const repo = useRepository();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [author, setAuthor] = useState('');
  const [label, setLabel] = useState<SectionLabel>('Season');
  const [error, setError] = useState<string | null>(null);
  const valid = title.trim().length > 0 && author.trim().length > 0;

  const create = async (): Promise<void> => {
    try {
      const novel = await repo.createNovel({ title, subtitle, author, sectionLabel: label });
      router.replace(routes.outline(novel.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the novel.');
    }
  };

  return (
    <Screen>
      <TextField label="Title" value={title} onChangeText={setTitle} testID="novel-title" />
      <TextField
        label="Subtitle (optional)"
        value={subtitle}
        onChangeText={setSubtitle}
        testID="novel-subtitle"
      />
      <TextField label="Author" value={author} onChangeText={setAuthor} testID="novel-author" />
      <SectionTitle>Sections are called</SectionTitle>
      <SegmentedButtons<SectionLabel>
        segments={SEGMENTS}
        value={label}
        onChange={setLabel}
        accessibilityLabel="Section name"
        testID="section-label"
      />
      {error ? (
        <AppText variant="bodyMedium" color="error">
          {error}
        </AppText>
      ) : null}
      <Button
        label="Create"
        variant="filled"
        disabled={!valid}
        onPress={() => void create()}
        testID="create-novel"
      />
    </Screen>
  );
}
