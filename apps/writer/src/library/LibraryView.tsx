// Library tab (root pager page 0): every novel on this phone as a literary shelf, plus new / settings entry points.
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { shareJson } from '../export/share-json';
import { RecentStrip } from '../components/RecentStrip.tsx';
import { NovelCard } from './NovelCard.tsx';
import { OnboardingLauncher } from '../onboarding/OnboardingLauncher.tsx';
import { routes } from '../routes.ts';
import { DEMO_NOVEL_ID, loadDemoNovel } from '../store/demo.ts';
import { useRepoQuery, useRepository } from '../store/context.tsx';
import { moveToTrash, TRASH_HINT } from '../store/trash.ts';
import { ActionButton } from '../ui/ActionButton.tsx';
import { useConfirm } from '../ui/ConfirmDialog.tsx';
import { IconBtn } from '../ui/IconBtn.tsx';
import { ScreenOptions } from '../ui/ScreenOptions.tsx';
import { Grid } from '../ui/Grid.tsx';
import { gridColumns } from '../ui/layout-class.ts';
import { useLayoutClass } from '../ui/use-layout-class.ts';
import { EmptyState, Page } from '../ui/Page.tsx';
import { Txt } from '../ui/Txt.tsx';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { space } from '../ui/tokens.ts';

export function LibraryView(): ReactNode {
  const repo = useRepository();
  const { t } = useI18n();
  const confirm = useConfirm();
  const { data: novels, error } = useRepoQuery('shelf', (r) => r.listNovels());
  const columns = gridColumns(useLayoutClass());

  const remove = async (id: string, title: string): Promise<void> => {
    if (
      await confirm({
        title: t('library.trash.title', { title }),
        message: t('library.trash.message', { hint: TRASH_HINT }),
        confirmLabel: t('library.trash.confirm'),
      })
    )
      await moveToTrash(repo, { kind: 'novel', novelId: id });
  };

  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const exportNovel = async (id: string): Promise<void> => {
    setNote(null);
    try {
      const filename = `${id}.json`;
      const result = await shareJson(filename, await repo.exportNovel(id));
      if (result === 'saved')
        setNote({ text: t('library.saved', { name: filename }), error: false });
    } catch (err) {
      setNote({
        text: err instanceof Error ? err.message : t('library.exportFailed'),
        error: true,
      });
    }
  };

  const loadDemo = async (): Promise<void> => {
    const exists = novels?.some((n) => n.id === DEMO_NOVEL_ID) ?? false;
    if (
      exists &&
      !(await confirm({
        title: t('library.demo.title'),
        message: t('library.demo.message'),
        confirmLabel: t('common.reset'),
        destructive: true,
      }))
    )
      return;
    await loadDemoNovel(repo);
  };

  const empty = novels?.length === 0;
  return (
    <Page wide>
      <OnboardingLauncher novelIds={novels ? novels.map((n) => n.id) : null} />
      <ScreenOptions
        options={{
          title: '',
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <IconBtn
                icon="plus"
                accessibilityLabel={t('library.newNovel')}
                onPress={() => router.push(routes.newNovel)}
                testID="new-novel"
              />
              <IconBtn
                icon="settings"
                accessibilityLabel={t('nav.settings')}
                onPress={() => router.push(routes.appSettings)}
                testID="open-settings"
              />
            </View>
          ),
        }}
      />
      <Txt variant="display" accessibilityRole="header" style={{ paddingTop: space.xs }}>
        {t('library.title')}
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
          {t('library.loadError')}
        </Txt>
      ) : null}
      {empty ? (
        <EmptyState
          icon="book-open"
          title={t('library.empty.title')}
          body={t('library.empty.body')}
          action={
            <View style={{ gap: space.xs, alignItems: 'center', paddingTop: space.sm }}>
              <ActionButton
                label={t('library.create')}
                onPress={() => router.push(routes.newNovel)}
              />
              <ActionButton
                variant="secondary"
                label={t('library.loadDemo')}
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
