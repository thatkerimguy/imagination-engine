// Bookshelf: every novel on this phone, plus new / demo / settings entry points.
import { router, Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, Text } from 'react-native';
import { NovelCard } from '../library/NovelCard.tsx';
import { routes } from '../routes.ts';
import { DEMO_NOVEL_ID, loadDemoNovel } from '../store/demo.ts';
import { useRepoQuery, useRepository } from '../store/context.tsx';
import { Button } from '../ui/Button.tsx';
import { confirmAction } from '../ui/confirm';
import { EmptyState, screenStyles } from '../ui/layout.tsx';
import { colors } from '../ui/theme.ts';

export default function BookshelfScreen(): ReactNode {
  const repo = useRepository();
  const { data: novels, error } = useRepoQuery('shelf', (r) => r.listNovels());

  const remove = async (id: string, title: string): Promise<void> => {
    if (
      await confirmAction(`Delete “${title}”?`, 'This removes the book from this phone.', 'Delete')
    )
      await repo.deleteNovel(id);
  };

  const loadDemo = async (): Promise<void> => {
    const exists = novels?.some((n) => n.id === DEMO_NOVEL_ID) ?? false;
    if (
      exists &&
      !(await confirmAction('Load demo', 'Reset the demo to its original state?', 'Reset'))
    )
      return;
    await loadDemoNovel(repo);
  };

  return (
    <ScrollView style={screenStyles.screen} contentContainerStyle={screenStyles.content}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button
              label="Settings"
              variant="ghost"
              compact
              onPress={() => router.push(routes.appSettings)}
              testID="app-settings"
            />
          ),
        }}
      />
      <Button
        label="New novel"
        variant="primary"
        onPress={() => router.push(routes.newNovel)}
        testID="new-novel"
      />
      {error ? <Text style={{ color: colors.danger }}>Could not load your books.</Text> : null}
      {novels?.length === 0 ? (
        <EmptyState
          title="No novels yet"
          body="Start a new one, or load the demo to look around."
        />
      ) : null}
      {novels?.map((n) => (
        <NovelCard
          key={n.id}
          novel={n}
          onOpen={() => router.push(routes.outline(n.id))}
          onDelete={() => void remove(n.id, n.title)}
        />
      ))}
      <Button
        label="Load demo novel (Chrome Tide)"
        onPress={() => void loadDemo()}
        testID="load-demo"
      />
    </ScrollView>
  );
}
