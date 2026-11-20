// Novel Settings: details, reading accent and which gimmick modules the book uses.
import type { NovelManifest, SectionLabel } from '@kn/core';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, Text } from 'react-native';
import { AccentPicker } from '../../../library/AccentPicker.tsx';
import { ModuleToggleRow } from '../../../library/ModuleToggleRow.tsx';
import { SECTION_LABELS } from '../../../library/section-labels.ts';
import { writerModules } from '../../../modules/registry.ts';
import { useRepoQuery, useRepository } from '../../../store/context.tsx';
import { ValidationError } from '../../../store/errors.ts';
import type { NovelRepository } from '../../../store/repository.ts';
import { Button } from '../../../ui/Button.tsx';
import { Chip } from '../../../ui/Chip.tsx';
import { Row, screenStyles, SectionTitle } from '../../../ui/layout.tsx';
import { TextField } from '../../../ui/TextField.tsx';
import { colors } from '../../../ui/theme.ts';

/** How many blocks in this novel's chapters use each module id. */
async function moduleUsage(repo: NovelRepository, novelId: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const season of await repo.listSeasons(novelId)) {
    for (const chapter of await repo.listChapters(novelId, season.id)) {
      for (const b of chapter.blocks) {
        if (b.kind === 'module') counts.set(b.moduleId, (counts.get(b.moduleId) ?? 0) + 1);
      }
    }
  }
  return counts;
}

export default function NovelSettingsScreen(): ReactNode {
  const { novelId } = useLocalSearchParams<{ novelId: string }>();
  const repo = useRepository();
  const { data } = useRepoQuery(`novel-settings:${novelId}`, async (r) => ({
    novel: await r.requireNovel(novelId),
    usage: await moduleUsage(r, novelId),
  }));
  const [draft, setDraft] = useState<NovelManifest | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  // Seed the editable copy once; later repository writes must not clobber unsaved edits.
  useEffect(() => {
    if (data && !draft) setDraft(data.novel);
  }, [data, draft]);

  if (!draft || !data) return <ScrollView style={screenStyles.screen} />;

  const edit = (patch: Partial<NovelManifest>): void => {
    setSaved(false);
    setDraft({ ...draft, ...patch });
  };

  const setAccent = (accent: string | undefined): void => {
    const theme = Object.fromEntries(Object.entries(draft.theme).filter(([k]) => k !== '--accent'));
    edit({ theme: accent ? { ...theme, '--accent': accent } : theme });
  };

  const toggle = (id: string, on: boolean): void => {
    const set = new Set(draft.enabledModules);
    if (on) set.add(id);
    else set.delete(id);
    const known = writerModules.map((m) => m.meta.id).filter((x) => set.has(x));
    const unknown = draft.enabledModules.filter((x) => set.has(x) && !known.includes(x));
    edit({ enabledModules: [...known, ...unknown] });
  };

  const save = async (): Promise<void> => {
    try {
      const next = await repo.saveNovel({
        ...draft,
        title: draft.title.trim(),
        author: draft.author.trim(),
      });
      setDraft(next);
      setErrors([]);
      setSaved(true);
    } catch (err) {
      setSaved(false);
      setErrors(
        err instanceof ValidationError
          ? err.errors
          : [err instanceof Error ? err.message : 'Could not save.'],
      );
    }
  };

  return (
    <ScrollView
      style={screenStyles.screen}
      contentContainerStyle={screenStyles.content}
      keyboardShouldPersistTaps="handled"
    >
      <SectionTitle>Details</SectionTitle>
      <TextField label="Title" value={draft.title} onChangeText={(title) => edit({ title })} />
      <TextField
        label="Subtitle"
        value={draft.subtitle ?? ''}
        onChangeText={(t) => {
          const rest: NovelManifest = { ...draft };
          delete rest.subtitle;
          setSaved(false);
          setDraft(t ? { ...rest, subtitle: t } : rest);
        }}
      />
      <TextField label="Author" value={draft.author} onChangeText={(author) => edit({ author })} />
      <Row>
        {SECTION_LABELS.map((l: SectionLabel) => (
          <Chip
            key={l}
            label={l}
            selected={draft.sectionLabel === l}
            onPress={() => edit({ sectionLabel: l })}
          />
        ))}
      </Row>
      <SectionTitle>Reading theme</SectionTitle>
      <AccentPicker value={draft.theme['--accent']} onChange={setAccent} />
      <SectionTitle>Gimmick modules</SectionTitle>
      {writerModules.map((m) => (
        <ModuleToggleRow
          key={m.meta.id}
          module={m}
          enabled={draft.enabledModules.includes(m.meta.id)}
          usedBy={data.usage.get(m.meta.id) ?? 0}
          onChange={(on) => toggle(m.meta.id, on)}
        />
      ))}
      {errors.map((e) => (
        <Text key={e} style={{ color: colors.danger }}>
          {e}
        </Text>
      ))}
      {saved ? <Text style={{ color: colors.ok }}>Saved</Text> : null}
      <Button
        label="Save"
        variant="primary"
        onPress={() => void save()}
        testID="novel-settings-save"
      />
    </ScrollView>
  );
}
