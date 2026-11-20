// Thin route: loads the note draft and hands it to <NoteEditor>, which draws its own top bar —
// the Stack header is turned off here (like the chapter route).
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NoteEditor } from '../../../notes/NoteEditor.tsx';
import { useNoteDraft } from '../../../notes/use-note-draft.ts';
import { routes } from '../../../routes.ts';
import { ItemLockGate } from '../../../security/LockGate.tsx';
import { VersionHistorySheet } from '../../../views/VersionHistorySheet.tsx';
import type { Block } from '@kn/core';
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
  const draft = useNoteDraft(docId);
  const [versions, setVersions] = useState(false);

  const back = (): void =>
    navigation.canGoBack()
      ? navigation.goBack()
      : router.replace(folder ? routes.folder(folder) : routes.notes);
  const header = <Stack.Screen options={{ headerShown: false }} />;

  if (draft.error || !draft.chapter) {
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
    <View style={styles.screen}>
      {header}
      <ItemLockGate itemId={docId} title={draft.chapter.title}>
        <NoteEditor
          docId={docId}
          draft={draft}
          onBack={back}
          onGrowth={() => router.push(routes.growth(`doc:${docId}`))}
          extraMenu={[
            {
              label: 'Version History',
              icon: 'clock',
              onPress: () => setVersions(true),
              testID: 'menu-versions',
            },
          ]}
        />
        <VersionHistorySheet
          visible={versions}
          target={`doc:${docId}`}
          currentBlocks={draft.chapter.blocks}
          onRestore={(blocks) => draft.update((c) => ({ ...c, blocks: blocks as Block[] }))}
          onClose={() => setVersions(false)}
        />
      </ItemLockGate>
    </View>
  );
}
