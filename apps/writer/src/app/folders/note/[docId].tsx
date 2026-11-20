// Thin route: loads the note draft and hands it to <NoteEditor>, which draws its own top bar —
// the Stack header is turned off here (like the chapter route).
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NoteEditor } from '../../../notes/NoteEditor.tsx';
import { useNoteDraft } from '../../../notes/use-note-draft.ts';
import { routes } from '../../../routes.ts';
import { useRepository } from '../../../store/context.tsx';
import { loadItemMeta } from '../../../store/item-meta.ts';
import { isRedacted } from '../../../store/unlock-session.ts';
import { ActionButton } from '../../../ui/ActionButton.tsx';
import { EmptyState } from '../../../ui/Page.tsx';
import { Txt } from '../../../ui/Txt.tsx';
import { makeStyles, useTheme } from '../../../ui/theme.tsx';
import { TopBar } from '../../../ui/TopBar.tsx';

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
}));

export default function NoteScreen(): ReactNode {
  const { docId, folder } = useLocalSearchParams<{ docId: string; folder?: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const styles = useStyles();
  const { colors } = useTheme();
  const repo = useRepository();
  const draft = useNoteDraft(docId);
  const [locked, setLocked] = useState<boolean | null>(null);
  useEffect(() => {
    void loadItemMeta(repo, docId).then((m) => setLocked(isRedacted(docId, m)));
  }, [repo, docId]);

  const back = (): void =>
    navigation.canGoBack()
      ? navigation.goBack()
      : router.replace(folder ? routes.folder(folder) : routes.notes);
  const header = <Stack.Screen options={{ headerShown: false }} />;

  if (locked) {
    return (
      <View style={styles.screen}>
        {header}
        <TopBar title="Locked note" onBack={back} />
        <EmptyState
          icon="lock"
          title="This note is locked"
          body="Unlock it to read or edit."
          action={<ActionButton label="Unlock" onPress={() => router.push(routes.lock)} />}
        />
      </View>
    );
  }
  if (draft.error || !draft.chapter || locked === null) {
    return (
      <View style={styles.screen}>
        {header}
        <TopBar title="Note" onBack={back} />
        <View style={styles.center}>
          {draft.error ? (
            <Txt color="inkSecondary">Could not open this note.</Txt>
          ) : (
            <ActivityIndicator color={colors.accent} />
          )}
        </View>
      </View>
    );
  }
  return (
    <>
      {header}
      <NoteEditor
        docId={docId}
        draft={draft}
        onBack={back}
        onGrowth={() => router.push(routes.growth(`doc:${docId}`))}
      />
    </>
  );
}
