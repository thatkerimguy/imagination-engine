// Thin route: loads the draft + novel, owns the header, and hands the rest to <ChapterEditor>.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ChapterEditor } from '../../../../../editor/ChapterEditor.tsx';
import { SaveStatus } from '../../../../../editor/SaveStatus.tsx';
import { routes } from '../../../../../routes.ts';
import { useRepoQuery } from '../../../../../store/context.tsx';
import { useChapterDraft } from '../../../../../store/use-chapter-draft.ts';
import { AppText } from '../../../../../ui/AppText.tsx';
import { Button } from '../../../../../ui/Button.tsx';
import { space } from '../../../../../ui/m3-tokens.ts';
import { makeStyles, useTheme } from '../../../../../ui/theme.tsx';

const useStyles = makeStyles((t) => ({
  right: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingRight: space.sm },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.surface,
  },
}));

export default function ChapterEditorScreen(): ReactNode {
  const { novelId, seasonId, chapterId } = useLocalSearchParams<{
    novelId: string;
    seasonId: string;
    chapterId: string;
  }>();
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const draft = useChapterDraft(novelId, seasonId, chapterId);
  const novel = useRepoQuery(`novel:${novelId}`, (repo) => repo.getNovel(novelId));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { chapter, flush } = draft;

  const preview = async (): Promise<void> => {
    await flush();
    router.push(routes.preview(novelId, seasonId, chapterId, selectedId ?? undefined));
  };

  const header = (
    <Stack.Screen
      options={{
        title: chapter?.title ?? 'Chapter',
        headerRight: () => (
          <View style={styles.right}>
            <SaveStatus status={draft.status} />
            <Button
              variant="tonal"
              icon="play-arrow"
              label="Preview"
              testID="preview-button"
              onPress={() => void preview()}
            />
          </View>
        ),
      }}
    />
  );

  if (draft.error) {
    return (
      <View style={styles.center}>
        {header}
        <AppText color="onSurfaceVariant">Could not open this chapter.</AppText>
      </View>
    );
  }
  if (!chapter || !novel.data) {
    return (
      <View style={styles.center}>
        {header}
        {novel.error ? (
          <AppText color="onSurfaceVariant">Could not open this novel.</AppText>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }
  return (
    <>
      {header}
      <ChapterEditor
        chapter={chapter}
        update={draft.update}
        enabledModules={novel.data.enabledModules}
        onSelectionChange={setSelectedId}
      />
    </>
  );
}
