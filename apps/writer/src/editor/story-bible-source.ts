// Loads the documents the story bible can mention (notes, characters, locations, lore): active (not trashed, not in a trashed folder),
// each with its folder path ("Places / Harbour").
import { listAllDocs, listAllFolders, type NoteBlock } from '../store/folders.ts';
import type { NovelRepository } from '../store/repository.ts';
import type { StoryKind } from '../notes/kind-meta.ts';
import type { MentionNote } from './story-bible.ts';

export interface StoryBibleNote extends MentionNote {
  kind: StoryKind;
  parentFolderId: string | null;
  blocks: NoteBlock[];
}

export async function loadStoryBibleNotes(repo: NovelRepository): Promise<StoryBibleNote[]> {
  const [folders, docs] = await Promise.all([listAllFolders(repo), listAllDocs(repo)]);
  const byId = new Map(folders.map((f) => [f.id, f]));
  const pathOf = (folderId: string | null): string => {
    const names: string[] = [];
    const seen = new Set<string>();
    let id = folderId;
    while (id && !seen.has(id)) {
      seen.add(id);
      const f = byId.get(id);
      if (!f) break;
      names.unshift(f.title);
      id = f.parentFolderId;
    }
    return names.join(' / ');
  };
  return docs
    .filter((d) => d.title.trim() !== '')
    .map((d) => {
      const folderPath = pathOf(d.parentFolderId);
      return {
        id: d.id,
        title: d.title,
        kind: d.kind,
        ...(folderPath ? { folderPath } : {}),
        parentFolderId: d.parentFolderId,
        blocks: d.blocks,
      };
    });
}
