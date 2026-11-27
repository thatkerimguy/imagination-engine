// New novel form: title and author are required; the book starts with one season and chapter
// in the Settings › Default workspace mode.
import type { SectionLabel, WorkspaceMode } from '@kn/core';
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { SECTION_LABELS } from '../library/section-labels.ts';
import { loadSettings } from '../settings/app-settings.ts';
import { routes } from '../routes.ts';
import { useRepository } from '../store/context.tsx';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Field } from '../ui/Field.tsx';
import { Page, SectionLabel as Label } from '../ui/Page.tsx';
import { SegmentControl, type SegmentOption } from '../ui/SegmentControl.tsx';
import { Txt } from '../ui/Txt.tsx';
import { ModePicker } from '../workspace/ModePicker.tsx';

export default function NewNovelScreen(): ReactNode {
  const repo = useRepository();
  const { t } = useI18n();
  const options: readonly SegmentOption<SectionLabel>[] = SECTION_LABELS.map((l) => ({
    value: l,
    label: t(`section.${l}`),
  }));
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [author, setAuthor] = useState('');
  const [label, setLabel] = useState<SectionLabel>('Season');
  const [mode, setMode] = useState<WorkspaceMode>('prose');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    // New books start in the Settings › Default workspace mode (Classic Novel unless changed).
    void loadSettings(repo).then((s) => live && setMode(s.defaultWorkspace));
    return () => {
      live = false;
    };
  }, [repo]);
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
      setError(err instanceof Error ? err.message : t('novel.createError'));
    }
  };

  return (
    <Page>
      <Field
        label={t('novel.title')}
        value={title}
        onChangeText={setTitle}
        serif
        testID="novel-title"
      />
      <Field
        label={t('novel.subtitleOptional')}
        value={subtitle}
        onChangeText={setSubtitle}
        testID="novel-subtitle"
      />
      <Field
        label={t('novel.author')}
        value={author}
        onChangeText={setAuthor}
        testID="novel-author"
      />
      <Label>{t('novel.sectionsCalled')}</Label>
      <SegmentControl<SectionLabel>
        options={options}
        value={label}
        onChange={setLabel}
        accessibilityLabel={t('novel.sectionName')}
        testID="section-label"
      />
      <Label>{t('novel.workspace')}</Label>
      <ModePicker value={mode} onChange={setMode} testID="new-novel-mode" />
      {error ? (
        <Txt variant="body" color="danger">
          {error}
        </Txt>
      ) : null}
      <ActionButton
        label={t('common.create')}
        disabled={!valid}
        onPress={() => void create()}
        testID="create-novel"
      />
    </Page>
  );
}
