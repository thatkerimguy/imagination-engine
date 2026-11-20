// Book Outline: seasons and chapters in reading order, with rename / reorder / status controls.
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { shareJson } from '../../../export/share-json';
import { GimmickLine } from '../../../library/GimmickLine.tsx';
import { SeasonCard } from '../../../library/SeasonCard.tsx';
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
import { Button } from '../../../ui/Button.tsx';
import { EmptyState, screenStyles } from '../../../ui/layout.tsx';
import { colors } from '../../../ui/theme.ts';

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
    <ScrollView style={screenStyles.screen} contentContainerStyle={screenStyles.content}>
      <Stack.Screen
        options={{
          title: novel?.title ?? 'Outline',
          headerRight: () => (
            <>
              <Button
                label="Settings"
                variant="ghost"
                compact
                onPress={() => router.push(routes.novelSettings(novelId))}
                testID="novel-settings"
              />
              <Button
                label="Export"
                variant="ghost"
                compact
                onPress={() => void exportBook()}
                testID="export-novel"
              />
            </>
          ),
        }}
      />
      {error ? <EmptyState title="This book could not be opened" /> : null}
      {novel ? (
        <GimmickLine
          enabled={novel.enabledModules}
          onPress={() => router.push(routes.novelSettings(novelId))}
        />
      ) : null}
      {problem ? <Text style={{ color: colors.danger }}>{problem}</Text> : null}
      {data?.seasons.map(({ season, chapters }, i) => (
        <SeasonCard
          key={season.id}
          season={season}
          chapters={chapters}
          index={i}
          sectionLabel={data.novel.sectionLabel}
          onRename={(t) => void run(() => renameSeason(repo, novelId, season.id, t))}
          onMove={(d) => void run(() => moveSeason(repo, novelId, season.id, d))}
          onAddChapter={() => void run(() => addChapter(repo, novelId, season.id))}
          chapterProps={(c) => ({
            onOpen: () => router.push(routes.chapter(novelId, season.id, c.id)),
            onCycleStatus: () =>
              void run(() =>
                updateChapterMeta(repo, novelId, season.id, c.id, { status: nextStatus(c.status) }),
              ),
            onMove: (d) => void run(() => moveChapter(repo, novelId, season.id, c.id, d)),
            onRename: (t) =>
              void run(() => updateChapterMeta(repo, novelId, season.id, c.id, { title: t })),
          })}
        />
      ))}
      {novel ? (
        <Button
          label={`+ ${novel.sectionLabel}`}
          onPress={() => void run(() => addSeason(repo, novelId))}
          testID="add-season"
        />
      ) : null}
    </ScrollView>
  );
}
