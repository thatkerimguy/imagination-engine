// The per-item ⋯ menu of the Notes workspace and the actions behind it.
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { deleteCoverFiles } from '../media/cover-files';
import { pickCoverImage } from '../media/pick-cover';
import { setItemCover } from '../store/covers.ts';
import { routes } from '../routes.ts';
import { useRepository } from '../store/context.tsx';
import { moveFolder, renameFolder, saveDoc } from '../store/folders.ts';
import { updateItemMeta, type ItemMeta } from '../store/item-meta.ts';
import { moveToTrash } from '../store/trash.ts';
import { unlockSession } from '../store/unlock-session.ts';
import { useConfirm } from '../ui/ConfirmDialog.tsx';
import type { MenuItem } from '../ui/PopoverMenu.tsx';
import type { NoteItem } from './use-notes-data.ts';

export type ItemSheet = 'rename' | 'move' | 'meta' | 'promote';

export function useItemMenu() {
  const repo = useRepository();
  const confirm = useConfirm();
  const { t } = useI18n();
  const [target, setTarget] = useState<{ item: NoteItem; sheet: ItemSheet } | null>(null);
  const close = useCallback(() => setTarget(null), []);

  const rename = async (item: NoteItem, name: string): Promise<void> => {
    close();
    if (item.kind === 'folder') await renameFolder(repo, item.id, name);
    else await saveDoc(repo, item.id, { title: name });
  };
  const move = async (item: NoteItem, parentId: string | null): Promise<void> => {
    close();
    if (item.kind === 'folder') await moveFolder(repo, item.id, parentId);
    else await saveDoc(repo, item.id, { parentFolderId: parentId });
  };
  const remove = async (item: NoteItem): Promise<void> => {
    const folder = item.kind === 'folder';
    const ok = await confirm({
      title: t('menu.trashTitle', { title: item.title }),
      message: `${folder ? `${t('menu.trashFolder')} ` : ''}${t('trash.hint')}`,
      confirmLabel: t('menu.trash'),
    });
    if (ok) await moveToTrash(repo, { kind: item.kind, id: item.id });
  };
  const setCover = async (item: NoteItem): Promise<void> => {
    const picked = await pickCoverImage();
    if (!picked) return;
    const { unusedUris } = await setItemCover(repo, item.id, picked);
    void deleteCoverFiles(unusedUris);
  };
  const toggleLock = async (item: NoteItem, locked: boolean): Promise<void> => {
    // The Author just locked it: keep it open for this session; it re-locks on next launch.
    if (!locked) unlockSession.unlockItem(item.id);
    await updateItemMeta(repo, item.id, { locked: locked ? undefined : true });
  };

  const menuFor = (item: NoteItem, meta: ItemMeta | undefined): MenuItem[] => {
    const open = (sheet: ItemSheet) => () => setTarget({ item, sheet });
    const pinned = meta?.pinned === true;
    const locked = meta?.locked === true;
    return [
      {
        label: t('menu.rename'),
        icon: 'edit-2',
        onPress: open('rename'),
        testID: `menu-rename-${item.id}`,
      },
      {
        label: t('menu.move'),
        icon: 'folder',
        onPress: open('move'),
        testID: `menu-move-${item.id}`,
      },
      { label: t('menu.meta'), icon: 'tag', onPress: open('meta'), testID: `menu-meta-${item.id}` },
      {
        label: pinned ? t('menu.unpin') : t('menu.pin'),
        icon: 'bookmark',
        onPress: () => void updateItemMeta(repo, item.id, { pinned: pinned ? undefined : true }),
      },
      {
        label: locked ? t('menu.unlock') : t('menu.lock'),
        icon: locked ? 'unlock' : 'lock',
        onPress: () => void toggleLock(item, locked),
      },
      { label: t('menu.cover'), icon: 'image', onPress: () => void setCover(item) },
      ...(item.kind === 'doc'
        ? [
            {
              label: t('menu.promote'),
              icon: 'arrow-up-right' as const,
              onPress: open('promote'),
            },
          ]
        : [
            {
              label: t('menu.compileFolder'),
              icon: 'book' as const,
              onPress: () => router.push(routes.compileFolder(item.id)),
            },
          ]),
      {
        label: t('menu.trash'),
        icon: 'trash-2',
        destructive: true,
        onPress: () => void remove(item),
        testID: `menu-delete-${item.id}`,
      },
    ];
  };

  return { target, close, menuFor, rename, move };
}
