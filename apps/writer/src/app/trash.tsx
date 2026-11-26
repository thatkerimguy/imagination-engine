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
import { useI18n } from '../i18n/I18nProvider.tsx';
import { space } from '../ui/tokens.ts';

export default function TrashScreen(): ReactNode {
  const repo = useRepository();
  const { t, formatNumber } = useI18n();
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
      setNote({
        text: err instanceof Error ? err.message : t('common.somethingWrong'),
        error: true,
      });
    } finally {
      setBusy(false);
    }
  };

  const restore = (item: TrashListItem): Promise<void> =>
    run(async () => {
      await restoreTrashedItem(repo, item.id);
      return t('trash.restored', { title: item.title });
    });

  const deleteForever = async (item: TrashListItem): Promise<void> => {
    const ok = await confirm({
      title: t('trash.deleteTitle', { title: item.title }),
      message: t('trash.deleteMessage'),
      confirmLabel: t('trash.deleteConfirm'),
      destructive: true,
    });
    if (ok)
      await run(async () => {
        await deleteCoverFiles(await permanentlyDeleteItem(repo, item.id));
        return t('trash.deleted', { title: item.title });
      });
  };

  const empty = async (): Promise<void> => {
    const n = items?.length ?? 0;
    const ok = await confirm({
      title: t('trash.emptyTitle'),
      message: t(n === 1 ? 'trash.emptyMessage.one' : 'trash.emptyMessage.other', {
        n: formatNumber(n),
      }),
      confirmLabel: t('trash.emptyAction'),
      destructive: true,
    });
    if (ok)
      await run(async () => {
        await deleteCoverFiles(await emptyTrash(repo));
        return t('trash.emptied');
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
                label={t('trash.emptyAction')}
                disabled={busy}
                onPress={() => void empty()}
                testID="trash-empty"
              />
            ) : null,
        }}
      />
      <Txt variant="meta" color="inkSecondary" testID="trash-summary">
        {t('trash.summary', { days: formatNumber(TRASH_RETENTION_DAYS) })}
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
        <EmptyState icon="trash-2" title={t('trash.empty.title')} body={t('trash.empty.body')} />
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
