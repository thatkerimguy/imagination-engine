// Bookshelf: every novel on this phone, plus new / demo / settings entry points.
import { router, Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { shareJson } from '../export/share-json';
import { NovelCard } from '../library/NovelCard.tsx';
import { routes } from '../routes.ts';
import { DEMO_NOVEL_ID, loadDemoNovel } from '../store/demo.ts';
import { useRepoQuery, useRepository } from '../store/context.tsx';
import { AppText } from '../ui/AppText.tsx';
import { Button } from '../ui/Button.tsx';
import { useConfirm } from '../ui/Dialog.tsx';
import { Fab } from '../ui/Fab.tsx';
import { IconButton } from '../ui/IconButton.tsx';
import { EmptyState, Screen } from '../ui/layout.tsx';
import { OverflowMenu } from '../ui/OverflowMenu.tsx';
import { useTheme } from '../ui/theme.tsx';

export default function BookshelfScreen(): ReactNode {
  const repo = useRepository();
  const confirm = useConfirm();
  const { colors } = useTheme();
  const { data: novels, error } = useRepoQuery('shelf', (r) => r.listNovels());

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

  const exportNovel = async (id: string): Promise<void> => {
    await shareJson(`${id}.json`, await repo.exportNovel(id));
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
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Stack.Screen
        options={{
          title: 'Bookshelf',
          headerRight: () => (
            <>
              <IconButton
                icon="settings"
                accessibilityLabel="Settings"
                onPress={() => router.push(routes.appSettings)}
                testID="app-settings"
              />
              {empty ? null : (
                <OverflowMenu
                  accessibilityLabel="More options"
                  items={[
                    {
                      label: 'Load demo novel',
                      icon: 'auto-stories',
                      onPress: () => void loadDemo(),
                      testID: 'load-demo',
                    },
                  ]}
                />
              )}
            </>
          ),
        }}
      />
      <Screen>
        {error ? (
          <AppText variant="bodyMedium" color="error">
            Could not load your books.
          </AppText>
        ) : null}
        {empty ? (
          <EmptyState
            icon="menu-book"
            title="No novels yet"
            body="Start a new one, or load the demo to look around."
            action={
              <Button
                label="Load demo novel (Chrome Tide)"
                variant="tonal"
                onPress={() => void loadDemo()}
                testID="load-demo"
              />
            }
          />
        ) : null}
        {novels?.map((n) => (
          <NovelCard
            key={n.id}
            novel={n}
            onOpen={() => router.push(routes.outline(n.id))}
            onExport={() => void exportNovel(n.id)}
            onDelete={() => void remove(n.id, n.title)}
          />
        ))}
      </Screen>
      <Fab
        label="New novel"
        icon="add"
        onPress={() => router.push(routes.newNovel)}
        testID="new-novel"
      />
    </View>
  );
}
