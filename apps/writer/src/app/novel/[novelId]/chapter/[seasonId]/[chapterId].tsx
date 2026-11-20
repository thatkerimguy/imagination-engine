// Thin route: loads the draft + novel, owns the header, and hands the rest to <ChapterEditor>.
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ChapterEditor } from '../../../../../editor/ChapterEditor.tsx';
import { SaveStatus } from '../../../../../editor/SaveStatus.tsx';
import { routes } from '../../../../../routes.ts';
import { useRepoQuery } from '../../../../../store/context.tsx';
import { useChapterDraft } from '../../../../../store/use-chapter-draft.ts';
import { Button } from '../../../../../ui/Button';
import { colors, space } from '../../../../../ui/legacy-theme.ts';

export default function ChapterEditorScreen(): ReactNode {
  const { novelId, seasonId, chapterId } = useLocalSearchParams<{
    novelId: string;
    seasonId: string;
    chapterId: string;
  }>();
  const router = useRouter();
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
              compact
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
        <Text style={styles.msg}>Could not open this chapter.</Text>
      </View>
    );
  }
  if (!chapter || !novel.data) {
    return (
      <View style={styles.center}>
        {header}
        {novel.error ? (
          <Text style={styles.msg}>Could not open this novel.</Text>
        ) : (
          <ActivityIndicator color={colors.accent} />
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

const styles = StyleSheet.create({
  right: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  msg: { color: colors.muted, fontSize: 15 },
});
