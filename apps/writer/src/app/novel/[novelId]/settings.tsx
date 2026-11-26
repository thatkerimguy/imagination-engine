// Novel Settings: details, reading accent and which gimmick modules the book uses.
import type { NovelManifest, SectionLabel } from '@kn/core';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { AccentPicker } from '../../../library/AccentPicker.tsx';
import { ModuleToggleRow } from '../../../library/ModuleToggleRow.tsx';
import { SECTION_LABELS } from '../../../library/section-labels.ts';
import { writerModules } from '../../../modules/registry.ts';
import { useRepoQuery, useRepository } from '../../../store/context.tsx';
import { ValidationError } from '../../../store/errors.ts';
import type { NovelRepository } from '../../../store/repository.ts';
import { routes } from '../../../routes.ts';
import { ActionButton } from '../../../ui/ActionButton.tsx';
import { Field } from '../../../ui/Field.tsx';
import { ListRow, Page, SectionLabel as Label } from '../../../ui/Page.tsx';
import { SegmentControl, type SegmentOption } from '../../../ui/SegmentControl.tsx';
import { Txt } from '../../../ui/Txt.tsx';
import { ModePicker } from '../../../workspace/ModePicker.tsx';
import { workspaceCapabilities } from '../../../workspace/mode-policy.ts';

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

const OPTIONS: readonly SegmentOption<SectionLabel>[] = SECTION_LABELS.map((l) => ({
  value: l,
  label: l,
}));

export default function NovelSettingsScreen(): ReactNode {
  const { novelId } = useLocalSearchParams<{ novelId: string }>();
  const repo = useRepository();
  const { data } = useRepoQuery(`novel-settings:${novelId}`, async (r) => ({
    novel: await r.requireNovel(novelId),
    usage: await moduleUsage(r, novelId),
    mode: await r.getWorkspaceMode(novelId),
  }));
  const [draft, setDraft] = useState<NovelManifest | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  // Seed the editable copy once; later repository writes must not clobber unsaved edits.
  useEffect(() => {
    if (data && !draft) setDraft(data.novel);
  }, [data, draft]);

  if (!draft || !data) return <Page />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(data.novel);
  const valid = draft.title.trim().length > 0 && draft.author.trim().length > 0;

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
    <Page>
      <Stack.Screen
        options={{
          title: 'Novel settings',
          headerRight: () => (
            <ActionButton
              label="Save"
              variant="ghost"
              disabled={!dirty || !valid}
              onPress={() => void save()}
              testID="novel-settings-save"
            />
          ),
        }}
      />
      <Label>Details</Label>
      <Field label="Title" value={draft.title} onChangeText={(title) => edit({ title })} serif />
      <Field
        label="Subtitle"
        value={draft.subtitle ?? ''}
        onChangeText={(t) => {
          const rest: NovelManifest = { ...draft };
          delete rest.subtitle;
          setSaved(false);
          setDraft(t ? { ...rest, subtitle: t } : rest);
        }}
      />
      <Field label="Author" value={draft.author} onChangeText={(author) => edit({ author })} />
      <SegmentControl
        options={OPTIONS}
        value={draft.sectionLabel}
        onChange={(sectionLabel: SectionLabel) => edit({ sectionLabel })}
        accessibilityLabel="Section name"
        testID="section-label"
      />
      <Label>Reading theme</Label>
      <AccentPicker value={draft.theme['--accent']} onChange={setAccent} />
      <Label>Workspace mode</Label>
      <ModePicker
        value={data.mode}
        onChange={(m) => void repo.setWorkspaceMode(novelId, m)}
        testID="settings-mode"
      />
      {workspaceCapabilities(data.mode).modulesSettings ? (
        <>
          <Label>Gimmick modules</Label>
          <View>
            {writerModules.map((m) => (
              <ModuleToggleRow
                key={m.meta.id}
                module={m}
                enabled={draft.enabledModules.includes(m.meta.id)}
                usedBy={data.usage.get(m.meta.id) ?? 0}
                onChange={(on) => toggle(m.meta.id, on)}
              />
            ))}
          </View>
        </>
      ) : (
        <Txt variant="meta" color="inkSecondary" testID="settings-modules-hidden-note">
          Interactive modules live in Interactive Studio. Switch anytime — you won't lose a word.
        </Txt>
      )}
      <Label>Insights</Label>
      <ListRow
        icon="trending-up"
        title="Growth"
        last
        testID="novel-growth"
        onPress={() => router.push(routes.growth(`novel:${novelId}`))}
      />
      {errors.map((e) => (
        <Txt key={e} variant="body" color="danger">
          {e}
        </Txt>
      ))}
      {saved ? (
        <Txt variant="body" color="accent">
          Saved
        </Txt>
      ) : null}
    </Page>
  );
}
