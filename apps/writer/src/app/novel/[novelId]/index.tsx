// Book Outline: seasons and chapters in reading order, with rename / reorder / status controls.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, View } from 'react-native';
import { shareJson } from '../../../export/share-json';
import { GimmickLine } from '../../../library/GimmickLine.tsx';
import { SeasonSection } from '../../../library/SeasonSection.tsx';
import { routes } from '../../../routes.ts';
import { useRepoQuery, useRepository } from '../../../store/context.tsx';
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

  const run = async (job: () => Promise<unknown>): Promise<void> => {
    try {
      setProblem(null);
      await job();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  const exportBook = (): Promise<void> =>
    run(async () => {
      try {
        await shareJson(`${novelId}.json`, await repo.exportNovel(novelId));
      } catch (err) {
        Alert.alert('Export failed', err instanceof Error ? err.message : 'Please try again.');
      }
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
                icon="settings"
                accessibilityLabel="Novel settings"
                onPress={() => router.push(routes.novelSettings(novelId))}
                testID="outline-settings"
              />
              <IconBtn
                icon="share"
                accessibilityLabel="Export"
                onPress={() => void exportBook()}
                testID="outline-export"
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
    </Page>
  );
}
