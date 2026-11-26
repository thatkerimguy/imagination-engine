// Trash: everything moved to Trash in the last 30 days, newest first. Restore puts an item back
// where it was (with its book / season / folders); Delete forever and Empty trash confirm first.
import { Stack } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { TrashRow } from '../components/TrashRow.tsx';
import { deleteCoverFiles } from '../media/cover-files';
import { useRepoQuery, useRepository } from '../store/context.tsx';
import {
  emptyTrash,
  listTrashedItems,
  permanentlyDeleteItem,
  restoreTrashedItem,
  TRASH_RETENTION_DAYS,
  type TrashListItem,
} from '../store/trash.ts';
import { ActionButton } from '../ui/ActionButton.tsx';
import { useConfirm } from '../ui/ConfirmDialog.tsx';
import { EmptyState, Page } from '../ui/Page.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';

export default function TrashScreen(): ReactNode {
  const repo = useRepository();
  const confirm = useConfirm();
  const { data: items } = useRepoQuery('trash', (r) => listTrashedItems(r));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);

  const run = async (job: () => Promise<string>): Promise<void> => {
    setBusy(true);
    setNote(null);
    try {
      setNote({ text: await job(), error: false });
    } catch (err) {
      setNote({ text: err instanceof Error ? err.message : 'Something went wrong.', error: true });
    } finally {
      setBusy(false);
    }
  };

  const restore = (item: TrashListItem): Promise<void> =>
    run(async () => {
      await restoreTrashedItem(repo, item.id);
      return `Restored “${item.title}”.`;
    });

  const deleteForever = async (item: TrashListItem): Promise<void> => {
    const ok = await confirm({
      title: `Delete “${item.title}” forever?`,
      message: 'This cannot be undone. Everything inside it is deleted too.',
      confirmLabel: 'Delete forever',
      destructive: true,
    });
    if (ok)
      await run(async () => {
        await deleteCoverFiles(await permanentlyDeleteItem(repo, item.id));
        return `Deleted “${item.title}”.`;
      });
  };

  const empty = async (): Promise<void> => {
    const n = items?.length ?? 0;
    const ok = await confirm({
      title: 'Empty trash?',
      message: `${n} ${n === 1 ? 'item is' : 'items are'} deleted forever. This cannot be undone.`,
      confirmLabel: 'Empty trash',
      destructive: true,
    });
    if (ok)
      await run(async () => {
        await deleteCoverFiles(await emptyTrash(repo));
        return 'Trash emptied.';
      });
  };

  const has = (items?.length ?? 0) > 0;
  return (
    <Page>
      <Stack.Screen
        options={{
          headerRight: () =>
            has ? (
              <ActionButton
                compact
                variant="danger"
                icon="trash-2"
                label="Empty trash"
                disabled={busy}
                onPress={() => void empty()}
                testID="trash-empty"
              />
            ) : null,
        }}
      />
      <Txt variant="meta" color="inkSecondary" testID="trash-summary">
        {`Items are deleted for good ${TRASH_RETENTION_DAYS} days after you move them here.`}
      </Txt>
      {note ? (
        <Txt
          variant="meta"
          color={note.error ? 'danger' : 'inkSecondary'}
          accessibilityLiveRegion="polite"
          testID="trash-note"
        >
          {note.text}
        </Txt>
      ) : null}
      {items && !has ? (
        <EmptyState icon="trash-2" title="Trash is empty" body="Deleted items appear here." />
      ) : null}
      <View style={{ gap: space.xxs }}>
        {items?.map((item) => (
          <TrashRow
            key={item.id}
            item={item}
            busy={busy}
            onRestore={() => void restore(item)}
            onDelete={() => void deleteForever(item)}
          />
        ))}
      </View>
    </Page>
  );
}
