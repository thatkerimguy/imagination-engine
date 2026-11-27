// Thin route: loads the draft + novel and hands everything to <ChapterEditor>, which draws its
// own slim top bar (so Focus Mode can hide it) — the Stack header is turned off here.
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ChapterEditor } from '../../../../../editor/ChapterEditor.tsx';
import { routes } from '../../../../../routes.ts';
import { ItemLockGate } from '../../../../../security/LockGate.tsx';
import { useRepoQuery, useRepository } from '../../../../../store/context.tsx';
import { useI18n } from '../../../../../i18n/I18nProvider.tsx';
import { moveToTrash } from '../../../../../store/trash.ts';
import { useConfirm } from '../../../../../ui/ConfirmDialog.tsx';
import { useChapterDraft } from '../../../../../store/use-chapter-draft.ts';
import { Txt } from '../../../../../ui/Txt.tsx';
import { makeStyles, useTheme } from '../../../../../ui/theme.tsx';
import { TopBar } from '../../../../../ui/TopBar.tsx';

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
}));

export default function ChapterEditorScreen(): ReactNode {
  const { novelId, seasonId, chapterId, block } = useLocalSearchParams<{
    novelId: string;
    seasonId: string;
    chapterId: string;
    block?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const styles = useStyles();
  const { colors } = useTheme();
  const draft = useChapterDraft(novelId, seasonId, chapterId);
  const novel = useRepoQuery(`novel:${novelId}`, (repo) => repo.getNovel(novelId));
  const mode = useRepoQuery(`mode:${novelId}`, (repo) => repo.getWorkspaceMode(novelId));
  const { chapter, flush } = draft;
  const from = { novel: novelId, season: seasonId, chapter: chapterId };

  const back = (): void =>
    navigation.canGoBack() ? navigation.goBack() : router.replace(routes.outline(novelId));
  const preview = async (blockId: string | null): Promise<void> => {
    await flush();
    router.push(routes.preview(novelId, seasonId, chapterId, blockId ?? undefined));
  };

  const repo = useRepository();
  const confirm = useConfirm();
  const { t } = useI18n();
  const trash = async (): Promise<void> => {
    const ok = await confirm({
      title: t('menu.trashTitle', { title: chapter?.title ?? t('kind.chapter') }),
      message: t('trash.hint'),
      confirmLabel: t('menu.trash'),
    });
    if (!ok) return;
    await flush();
    await moveToTrash(repo, { kind: 'chapter', novelId, seasonId, chapterId });
    router.replace(routes.outline(novelId));
  };

  const header = <Stack.Screen options={{ headerShown: false }} />;
  if (draft.error || novel.error || !chapter || !novel.data) {
    const failed = draft.error || novel.error;
    return (
      <View style={styles.screen}>
        {header}
        <TopBar title="Chapter" onBack={back} />
        <View style={styles.center}>
          {failed ? (
            <Txt color="inkSecondary">Could not open this chapter.</Txt>
          ) : (
            <ActivityIndicator color={colors.accent} />
          )}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.screen}>
      {header}
      <ItemLockGate itemId={chapterId} title={chapter.title}>
        <ChapterEditor
          chapter={chapter}
          draft={draft}
          enabledModules={novel.data.enabledModules}
          mode={mode.data ?? 'prose'}
          onBack={back}
          onPreview={(id) => void preview(id)}
          onGrowth={() => router.push(routes.growth(`chapter:${chapterId}`, from))}
          onAppearance={() => router.push(routes.appearance)}
          onTrash={() => void trash()}
          {...(block ? { initialBlockId: block } : {})}
        />
      </ItemLockGate>
    </View>
  );
}
