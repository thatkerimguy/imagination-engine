// New novel form: title and author are required; the book starts with one season and chapter.
import type { SectionLabel, WorkspaceMode } from '@kn/core';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { SECTION_LABELS } from '../library/section-labels.ts';
import { routes } from '../routes.ts';
import { useRepository } from '../store/context.tsx';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Field } from '../ui/Field.tsx';
import { Page, SectionLabel as Label } from '../ui/Page.tsx';
import { SegmentControl, type SegmentOption } from '../ui/SegmentControl.tsx';
import { Txt } from '../ui/Txt.tsx';
import { ModePicker } from '../workspace/ModePicker.tsx';

const OPTIONS: readonly SegmentOption<SectionLabel>[] = SECTION_LABELS.map((l) => ({
  value: l,
  label: l,
}));

export default function NewNovelScreen(): ReactNode {
  const repo = useRepository();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [author, setAuthor] = useState('');
  const [label, setLabel] = useState<SectionLabel>('Season');
  const [mode, setMode] = useState<WorkspaceMode>('prose');
  const [error, setError] = useState<string | null>(null);
  const valid = title.trim().length > 0 && author.trim().length > 0;

  const create = async (): Promise<void> => {
    try {
      const novel = await repo.createNovel({
        title,
        subtitle,
        author,
        sectionLabel: label,
        workspaceMode: mode,
      });
      router.replace(routes.outline(novel.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the novel.');
    }
  };

  return (
    <Page>
      <Field label="Title" value={title} onChangeText={setTitle} serif testID="novel-title" />
      <Field
        label="Subtitle (optional)"
        value={subtitle}
        onChangeText={setSubtitle}
        testID="novel-subtitle"
      />
      <Field label="Author" value={author} onChangeText={setAuthor} testID="novel-author" />
      <Label>Sections are called</Label>
      <SegmentControl<SectionLabel>
        options={OPTIONS}
        value={label}
        onChange={setLabel}
        accessibilityLabel="Section name"
        testID="section-label"
      />
      <Label>Workspace</Label>
      <ModePicker value={mode} onChange={setMode} testID="new-novel-mode" />
      {error ? (
        <Txt variant="body" color="danger">
          {error}
        </Txt>
      ) : null}
      <ActionButton
        label="Create"
        disabled={!valid}
        onPress={() => void create()}
        testID="create-novel"
      />
    </Page>
  );
}
