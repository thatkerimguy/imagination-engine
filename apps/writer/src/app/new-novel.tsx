// New novel form: title and author are required; the book starts with one season and chapter.
import type { SectionLabel } from '@kn/core';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, Text } from 'react-native';
import { SECTION_LABELS } from '../library/section-labels.ts';
import { routes } from '../routes.ts';
import { useRepository } from '../store/context.tsx';
import { Button } from '../ui/Button.tsx';
import { Chip } from '../ui/Chip.tsx';
import { Row, screenStyles, SectionTitle } from '../ui/layout.tsx';
import { TextField } from '../ui/TextField.tsx';
import { colors } from '../ui/legacy-theme.ts';

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
    <ScrollView
      style={screenStyles.screen}
      contentContainerStyle={screenStyles.content}
      keyboardShouldPersistTaps="handled"
    >
      <TextField label="Title" value={title} onChangeText={setTitle} testID="novel-title" />
      <TextField
        label="Subtitle (optional)"
        value={subtitle}
        onChangeText={setSubtitle}
        testID="novel-subtitle"
      />
      <TextField label="Author" value={author} onChangeText={setAuthor} testID="novel-author" />
      <SectionTitle>Sections are called</SectionTitle>
      <Row>
        {SECTION_LABELS.map((l) => (
          <Chip key={l} label={l} selected={l === label} onPress={() => setLabel(l)} />
        ))}
      </Row>
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      <Button
        label="Create"
        variant="primary"
        disabled={!valid}
        onPress={() => void create()}
        testID="create-novel"
      />
    </ScrollView>
  );
}
