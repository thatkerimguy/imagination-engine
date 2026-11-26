// Book Outline: seasons and chapters in reading order, with rename / reorder / status controls.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ItemMetaSheet } from '../../../components/ItemMetaSheet.tsx';
import { pickAndImport } from '../../../import/pick-import.ts';
import { TeaserSheet } from '../../../teaser/TeaserSheet.tsx';
import { PublishSheet } from '../../../publish/PublishSheet.tsx';
import { PopoverMenu } from '../../../ui/PopoverMenu.tsx';
import { View } from 'react-native';
import { shareJson } from '../../../export/share-json';
import { GimmickLine } from '../../../library/GimmickLine.tsx';
import { SeasonSection } from '../../../library/SeasonSection.tsx';
import { routes } from '../../../routes.ts';
import { useRepoQuery, useRepository } from '../../../store/context.tsx';
import { moveToTrash, TRASH_HINT, type TrashTarget } from '../../../store/trash.ts';
import { useConfirm } from '../../../ui/ConfirmDialog.tsx';
import {
  addChapter,
  addSeason,
  moveChapter,
  moveSeason,
  nextStatus,
  renameSeason,
  updateChapterMeta,
} from '../../../store/outline.ts';
import { ActionButton } from '../../../ui/ActionButton.tsx';
import { IconBtn } from '../../../ui/IconBtn.tsx';
import { EmptyState, Page } from '../../../ui/Page.tsx';
import { Txt } from '../../../ui/Txt.tsx';
import { space } from '../../../ui/tokens.ts';

export default function OutlineScreen(): ReactNode {
  const { novelId } = useLocalSearchParams<{ novelId: string }>();
  const repo = useRepository();
  const { data, error } = useRepoQuery(`outline:${novelId}`, (r) => r.exportNovel(novelId));
  const [problem, setProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [metaOpen, setMetaOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [teaserOpen, setTeaserOpen] = useState(false);
  const confirm = useConfirm();
  const trash = async (title: string, target: TrashTarget): Promise<void> => {
    const ok = await confirm({
      title: `Move “${title}” to Trash?`,
      message: TRASH_HINT,
      confirmLabel: 'Move to Trash',
    });
    if (ok) await run(() => moveToTrash(repo, target));
  };

  const run = async (job: () => Promise<unknown>): Promise<void> => {
    try {
      setProblem(null);
      setSaved(null);
      await job();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  const exportBook = (): Promise<void> =>
    run(async () => {
      const filename = `${novelId}.json`;
      const result = await shareJson(filename, await repo.exportNovel(novelId));
      if (result === 'saved') setSaved(`Saved ${filename}`);
    });

  const importChapter = (): Promise<void> =>
    run(async () => {
      const last = data?.seasons.at(-1)?.season.id;
      if (!last) return;
      const id = await pickAndImport(repo, { novelId, seasonId: last });
      if (id) router.push(routes.chapter(novelId, last, id));
    });

  const novel = data?.novel;
  return (
    <Page>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <IconBtn
                icon="upload-cloud"
                accessibilityLabel="Publish to web"
                onPress={() => setPublishOpen(true)}
                testID="outline-publish"
              />
              <IconBtn
                icon="settings"
                accessibilityLabel="Novel settings"
                onPress={() => router.push(routes.novelSettings(novelId))}
                testID="outline-settings"
              />
              <PopoverMenu
                accessibilityLabel="Book options"
                testID="outline-menu"
                items={[
                  {
                    label: 'Publish to web…',
                    icon: 'upload-cloud',
                    onPress: () => setPublishOpen(true),
                    testID: 'outline-menu-publish',
                  },
                  {
                    label: 'Compile & Export Book',
                    icon: 'printer',
                    onPress: () => router.push(routes.compile(novelId)),
                    testID: 'outline-compile',
                  },
                  {
                    label: 'Import .txt / .md / .docx',
                    icon: 'download',
                    onPress: () => void importChapter(),
                    testID: 'outline-import',
                  },
                  {
                    label: 'Create 9:16 teaser',
                    icon: 'smartphone',
                    onPress: () => setTeaserOpen(true),
                    testID: 'menu-create-teaser',
                  },
                  {
                    label: 'Tags & Color',
                    icon: 'tag',
                    onPress: () => setMetaOpen(true),
                    testID: 'outline-meta',
                  },
                  {
                    label: 'Export JSON',
                    icon: 'share',
                    onPress: () => void exportBook(),
                    testID: 'outline-export',
                  },
                ]}
              />
            </View>
          ),
        }}
      />
      {error ? <EmptyState title="This book could not be opened" /> : null}
      {novel ? (
        <View style={{ gap: space.xxs, paddingTop: space.xs }}>
          <Txt variant="display" accessibilityRole="header">
            {novel.title}
          </Txt>
          {novel.subtitle ? (
            <Txt variant="body" color="inkSecondary" style={{ fontStyle: 'italic' }}>
              {novel.subtitle}
            </Txt>
          ) : null}
          <GimmickLine
            enabled={novel.enabledModules}
            onPress={() => router.push(routes.novelSettings(novelId))}
          />
        </View>
      ) : null}
      {problem ? (
        <Txt variant="body" color="danger">
          {problem}
        </Txt>
      ) : null}
      {saved ? (
        <Txt
          variant="meta"
          color="inkSecondary"
          accessibilityLiveRegion="polite"
          testID="outline-saved"
        >
          {saved}
        </Txt>
      ) : null}
      {data?.seasons.map(({ season, chapters }, i) => (
        <SeasonSection
          key={season.id}
          season={season}
          chapters={chapters}
          index={i}
          count={data.seasons.length}
          sectionLabel={data.novel.sectionLabel}
          onRename={(t) => void run(() => renameSeason(repo, novelId, season.id, t))}
          onMove={(d) => void run(() => moveSeason(repo, novelId, season.id, d))}
          onAddChapter={() => void run(() => addChapter(repo, novelId, season.id))}
          onTrash={() => void trash(season.title, { kind: 'season', novelId, seasonId: season.id })}
          chapterProps={(c) => ({
            onOpen: () => router.push(routes.chapter(novelId, season.id, c.id)),
            onCycleStatus: () =>
              void run(() =>
                updateChapterMeta(repo, novelId, season.id, c.id, {
                  status: nextStatus(c.status),
                }),
              ),
            onMove: (d) => void run(() => moveChapter(repo, novelId, season.id, c.id, d)),
            onRename: (t) =>
              void run(() => updateChapterMeta(repo, novelId, season.id, c.id, { title: t })),
            onTrash: () =>
              void trash(c.title, {
                kind: 'chapter',
                novelId,
                seasonId: season.id,
                chapterId: c.id,
              }),
          })}
        />
      ))}
      {novel ? (
        <View style={{ alignItems: 'flex-start' }}>
          <ActionButton
            variant="secondary"
            icon="plus"
            label={`Add ${novel.sectionLabel.toLowerCase()}`}
            accessibilityLabel={`Add ${novel.sectionLabel}`}
            onPress={() => void run(() => addSeason(repo, novelId))}
            testID="add-season"
          />
        </View>
      ) : null}
      {novel ? (
        <ItemMetaSheet
          visible={metaOpen}
          itemId={novelId}
          title={novel.title}
          onClose={() => setMetaOpen(false)}
        />
      ) : null}
      <TeaserSheet visible={teaserOpen} novelId={novelId} onClose={() => setTeaserOpen(false)} />
      <PublishSheet visible={publishOpen} novelId={novelId} onClose={() => setPublishOpen(false)} />
    </Page>
  );
}
