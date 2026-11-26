// The Notes workspace for one level (root or a folder): title, breadcrumbs, sort, hairline rows
// for folders and notes, and the sheets behind the per-item ⋯ menu.
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, View } from 'react-native';
import { RecentStrip } from '../components/RecentStrip.tsx';
import { ItemMetaSheet } from '../components/ItemMetaSheet.tsx';
import { folderHref, routes } from '../routes.ts';
import { useRepoQuery, useRepository } from '../store/context.tsx';
import { createDoc, createFolder, listAllFolders } from '../store/folders.ts';
import { SORT_LABELS, type SortMode } from '../store/item-meta.ts';
import { IconBtn } from '../ui/IconBtn.tsx';
import { ScreenOptions } from '../ui/ScreenOptions.tsx';
import { pickAndImport } from '../import/pick-import.ts';
import { Grid } from '../ui/Grid.tsx';
import { gridColumns } from '../ui/layout-class.ts';
import { useLayoutClass } from '../ui/use-layout-class.ts';
import { EmptyState, Page } from '../ui/Page.tsx';
import { PopoverMenu } from '../ui/PopoverMenu.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { Breadcrumbs } from './Breadcrumbs.tsx';
import { MoveSheet } from './MoveSheet.tsx';
import { NameSheet } from './NameSheet.tsx';
import { NoteRow } from './NoteRow.tsx';
import { usePromote } from './promote.ts';
import { PromoteSheet } from './PromoteSheet.tsx';
import { useItemMenu } from './use-item-menu.ts';
import { useNotesData, type NoteItem } from './use-notes-data.ts';

const SORTS = Object.keys(SORT_LABELS) as SortMode[];

export function NotesWorkspace({ folderId }: { folderId: string | null }): ReactNode {
  const repo = useRepository();
  const data = useNotesData(folderId);
  const allFolders = useRepoQuery('notes-all-folders', listAllFolders);
  const menu = useItemMenu();
  const promote = usePromote();
  const [newFolder, setNewFolder] = useState(false);
  const { items = [], meta, crumbs = [], folder, sort = 'date-edited' } = data.data ?? {};
  const title = folderId ? (folder?.title ?? '') : 'Notes';

  const open = (item: NoteItem): void =>
    router.push(
      item.kind === 'folder' ? folderHref(item.id, folderId) : routes.note(item.id, folderId),
    );
  const addNote = async (): Promise<void> => {
    const doc = await createDoc(repo, folderId);
    router.push(routes.note(doc.id, folderId));
  };
  const importDoc = async (): Promise<void> => {
    try {
      const id = await pickAndImport(repo, { folderId });
      if (id) router.push(routes.note(id, folderId));
    } catch (err) {
      Alert.alert('Import failed', err instanceof Error ? err.message : 'Please try again.');
    }
  };
  const picked = menu.target;
  const columns = gridColumns(useLayoutClass());

  return (
    <Page wide>
      <ScreenOptions
        options={{
          title: '',
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <IconBtn
                icon="folder-plus"
                accessibilityLabel="New folder"
                onPress={() => setNewFolder(true)}
                testID="notes-new-folder"
              />
              <IconBtn
                icon="file-plus"
                accessibilityLabel="New note"
                onPress={() => void addNote()}
                testID="notes-new-note"
              />
              <IconBtn
                icon="download"
                accessibilityLabel="Import .txt, .md or .docx"
                onPress={() => void importDoc()}
                testID="notes-import"
              />
            </View>
          ),
        }}
      />
      <Txt
        variant="display"
        accessibilityRole="header"
        style={{ paddingTop: space.xs }}
        numberOfLines={1}
      >
        {title}
      </Txt>
      {folderId ? null : <RecentStrip />}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>{folderId ? <Breadcrumbs crumbs={crumbs} /> : null}</View>
        <PopoverMenu
          icon="sliders"
          accessibilityLabel={`Sort: ${SORT_LABELS[sort]}`}
          testID="notes-sort"
          items={SORTS.map((m) => ({
            label: SORT_LABELS[m],
            icon: m === sort ? 'check' : undefined,
            onPress: () => void data.setSort(m),
            testID: `sort-${m}`,
          }))}
        />
      </View>
      {data.data && items.length === 0 ? (
        <EmptyState
          icon={folderId ? 'folder' : 'edit-3'}
          title={folderId ? 'This folder is empty' : 'No notes yet'}
          body="Use the buttons above to add a folder or a note."
        />
      ) : null}
      <Grid columns={columns} testID="notes-grid">
        {items.map((item) => (
          <NoteRow
            key={`${item.kind}:${item.id}`}
            item={item}
            meta={meta?.get(item.id)}
            menu={menu.menuFor(item, meta?.get(item.id))}
            onOpen={() => open(item)}
          />
        ))}
      </Grid>

      <NameSheet
        visible={newFolder}
        title="New folder"
        initial=""
        confirmLabel="Create"
        onClose={() => setNewFolder(false)}
        onSubmit={(name) => {
          setNewFolder(false);
          void createFolder(repo, name, folderId);
        }}
      />
      <NameSheet
        visible={picked?.sheet === 'rename'}
        title="Rename"
        initial={picked?.item.title ?? ''}
        confirmLabel="Save"
        onClose={menu.close}
        onSubmit={(name) => picked && void menu.rename(picked.item, name)}
      />
      <MoveSheet
        visible={picked?.sheet === 'move'}
        itemTitle={picked?.item.title ?? ''}
        folders={allFolders.data ?? []}
        movingFolderId={picked?.item.kind === 'folder' ? picked.item.id : null}
        currentParentId={picked?.item.parentId ?? null}
        onPick={(id) => picked && void menu.move(picked.item, id)}
        onClose={menu.close}
      />
      <ItemMetaSheet
        visible={picked?.sheet === 'meta'}
        itemId={picked?.item.id ?? ''}
        title={picked?.item.title ?? ''}
        onClose={menu.close}
      />
      <PromoteSheet
        visible={picked?.sheet === 'promote'}
        noteTitle={picked?.item.title ?? ''}
        onClose={menu.close}
        onPick={(n, s) => {
          const id = picked?.item.id;
          menu.close();
          if (id) void promote(id, n, s);
        }}
      />
    </Page>
  );
}
