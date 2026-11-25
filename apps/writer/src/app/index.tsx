// Library: every novel on this phone as a literary shelf, plus new / settings entry points.
import { router, Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { shareJson } from '../export/share-json';
import { RecentStrip } from '../components/RecentStrip.tsx';
import { NovelCard } from '../library/NovelCard.tsx';
import { routes } from '../routes.ts';
import { DEMO_NOVEL_ID, loadDemoNovel } from '../store/demo.ts';
import { useRepoQuery, useRepository } from '../store/context.tsx';
import { ActionButton } from '../ui/ActionButton.tsx';
import { useConfirm } from '../ui/ConfirmDialog.tsx';
import { IconBtn } from '../ui/IconBtn.tsx';
import { Grid } from '../ui/Grid.tsx';
import { gridColumns } from '../ui/layout-class.ts';
import { useLayoutClass } from '../ui/use-layout-class.ts';
import { EmptyState, Page } from '../ui/Page.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';

export default function LibraryScreen(): ReactNode {
  const repo = useRepository();
  const confirm = useConfirm();
  const { data: novels, error } = useRepoQuery('shelf', (r) => r.listNovels());
  const columns = gridColumns(useLayoutClass());

  const remove = async (id: string, title: string): Promise<void> => {
    if (
      await confirm({
        title: `Delete “${title}”?`,
        message: 'This removes the book from this phone.',
        confirmLabel: 'Delete',
        destructive: true,
      })
    )
      await repo.deleteNovel(id);
  };

  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const exportNovel = async (id: string): Promise<void> => {
    setNote(null);
    try {
      const filename = `${id}.json`;
      const result = await shareJson(filename, await repo.exportNovel(id));
      if (result === 'saved') setNote({ text: `Saved ${filename}`, error: false });
    } catch (err) {
      setNote({ text: err instanceof Error ? err.message : 'Export failed.', error: true });
    }
  };

  const loadDemo = async (): Promise<void> => {
    const exists = novels?.some((n) => n.id === DEMO_NOVEL_ID) ?? false;
    if (
      exists &&
      !(await confirm({
        title: 'Load demo',
        message: 'Reset the demo to its original state?',
        confirmLabel: 'Reset',
        destructive: true,
      }))
    )
      return;
    await loadDemoNovel(repo);
  };

  const empty = novels?.length === 0;
  return (
    <Page wide>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <IconBtn
                icon="plus"
                accessibilityLabel="New novel"
                onPress={() => router.push(routes.newNovel)}
                testID="new-novel"
              />
              <IconBtn
                icon="settings"
                accessibilityLabel="Settings"
                onPress={() => router.push(routes.appSettings)}
                testID="open-settings"
              />
            </View>
          ),
        }}
      />
      <Txt variant="display" accessibilityRole="header" style={{ paddingTop: space.xs }}>
        Library
      </Txt>
      <RecentStrip />
      {note ? (
        <Txt
          variant="meta"
          color={note.error ? 'danger' : 'inkSecondary'}
          accessibilityLiveRegion="polite"
          testID="library-note"
        >
          {note.text}
        </Txt>
      ) : null}
      {error ? (
        <Txt variant="body" color="danger">
          Could not load your books.
        </Txt>
      ) : null}
      {empty ? (
        <EmptyState
          icon="book-open"
          title="No novels yet"
          body="Start a new one, or load the demo to look around."
          action={
            <View style={{ gap: space.xs, alignItems: 'center', paddingTop: space.sm }}>
              <ActionButton label="Create a novel" onPress={() => router.push(routes.newNovel)} />
              <ActionButton
                variant="secondary"
                label="Load Chrome Tide demo"
                onPress={() => void loadDemo()}
                testID="load-demo"
              />
            </View>
          }
        />
      ) : null}
      <Grid columns={columns} testID="library-grid">
        {novels?.map((n) => (
          <NovelCard
            key={n.id}
            novel={n}
            onOpen={() => router.push(routes.outline(n.id))}
            onExport={() => void exportNovel(n.id)}
            onSettings={() => router.push(routes.novelSettings(n.id))}
            onDelete={() => void remove(n.id, n.title)}
          />
        ))}
      </Grid>
    </Page>
  );
}
