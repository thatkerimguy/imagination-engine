// "Move to Folder": every folder as an indented tree under "Notes (root)". A folder can never be
// moved into itself or any of its own sub-folders.
import { useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import type { FolderRecord } from '../store/folders.ts';
import { Glyph } from '../ui/Glyph.tsx';
import { Press } from '../ui/Press.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';

export interface FolderTreeRow {
  id: string | null;
  title: string;
  depth: number;
  disabled: boolean;
}

/** Depth-first tree rows; `blocked` ids (and everything under them) are disabled. Pure. */
export function folderTree(
  folders: readonly FolderRecord[],
  blocked: ReadonlySet<string>,
): FolderTreeRow[] {
  const rows: FolderTreeRow[] = [{ id: null, title: 'Notes (root)', depth: 0, disabled: false }];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number, dead: boolean): void => {
    const kids = folders
      .filter((f) => f.parentFolderId === parent)
      .sort((a, b) => a.title.localeCompare(b.title));
    for (const f of kids) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      const off = dead || blocked.has(f.id);
      rows.push({ id: f.id, title: f.title, depth, disabled: off });
      walk(f.id, depth + 1, off);
    }
  };
  walk(null, 1, false);
  return rows;
}

export interface MoveSheetProps {
  visible: boolean;
  itemTitle: string;
  folders: readonly FolderRecord[];
  /** The folder being moved (its subtree is disabled); `null` for a document. */
  movingFolderId: string | null;
  currentParentId: string | null;
  onPick(folderId: string | null): void;
  onClose(): void;
}

export function MoveSheet(p: MoveSheetProps): ReactNode {
  const rows = useMemo(
    () => folderTree(p.folders, new Set(p.movingFolderId ? [p.movingFolderId] : [])),
    [p.folders, p.movingFolderId],
  );
  return (
    <Sheet
      visible={p.visible}
      title="Move to Folder"
      subtitle={p.itemTitle}
      onClose={p.onClose}
      testID="move-sheet"
    >
      <View>
        {rows.map((r) => (
          <Press
            key={r.id ?? 'root'}
            disabled={r.disabled || r.id === p.currentParentId}
            accessibilityRole="button"
            accessibilityLabel={`Move to ${r.title}`}
            onPress={() => p.onPick(r.id)}
            testID={`move-to-${r.id ?? 'root'}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.xs,
              minHeight: 44,
              paddingLeft: r.depth * space.md,
            }}
          >
            <Glyph name={r.id === null ? 'home' : 'folder'} size={16} color="inkSecondary" />
            <Txt variant="body" numberOfLines={1} style={{ flex: 1 }}>
              {r.title}
            </Txt>
            {r.id === p.currentParentId ? <Glyph name="check" size={16} color="inkMuted" /> : null}
          </Press>
        ))}
      </View>
    </Sheet>
  );
}
