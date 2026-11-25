// "Import…": pick a .txt / .md / .docx (or a .knchap into a book) and add it as a new chapter
// or a new note. Returns the created id, or null when the picker was cancelled.
import * as DocumentPicker from 'expo-document-picker';
import { importChapterArchive } from '../backup/archive-repo.ts';
import { saveChapterStyles, pruneStyles } from '../store/chapter-styles.ts';
import { createDoc } from '../store/folders.ts';
import { newSlugId } from '../store/ids.ts';
import type { NovelRepository } from '../store/repository.ts';
import type { ImportedDoc } from './build.ts';
import { parseDocx } from './docx.ts';
import { parseMarkdown } from './markdown.ts';
import { readAssetBytes } from './read-asset.ts';
import { parseTxt } from './txt.ts';

export type ImportTarget = { novelId: string; seasonId: string } | { folderId: string | null };

const stemOf = (name: string): string => name.replace(/\.[^.]+$/, '').trim();
const extOf = (name: string): string => /\.([A-Za-z0-9]+)$/.exec(name)?.[1]?.toLowerCase() ?? '';

async function parseFile(name: string, bytes: Uint8Array): Promise<ImportedDoc> {
  const stem = stemOf(name) || undefined;
  const text = (): string => new TextDecoder('utf-8').decode(bytes);
  switch (extOf(name)) {
    case 'txt':
      return parseTxt(text(), stem);
    case 'md':
    case 'markdown':
      return parseMarkdown(text(), stem);
    case 'docx':
      return parseDocx(bytes, stem);
    default:
      throw new Error('Choose a .txt, .md or .docx file.');
  }
}

async function addChapter(
  repo: NovelRepository,
  doc: ImportedDoc,
  novelId: string,
  seasonId: string,
) {
  const season = await repo.getSeason(novelId, seasonId);
  if (!season) throw new Error('That season was not found.');
  const id = newSlugId();
  const saved = await repo.saveChapter(novelId, {
    id,
    seasonId,
    title: doc.title?.trim() || 'Imported chapter',
    status: 'draft',
    blocks: doc.blocks,
  });
  if (saved.chapter.blocks.length === 0)
    throw new Error('Nothing to import: the file has no text.');
  await repo.saveSeason(novelId, { ...season, chapters: [...season.chapters, id] });
  await saveChapterStyles(
    repo,
    id,
    pruneStyles(
      doc.styles,
      saved.chapter.blocks.map((b) => b.id),
    ),
  );
  return id;
}

export async function pickAndImport(
  repo: NovelRepository,
  target: ImportTarget,
): Promise<string | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  const asset = picked.canceled ? undefined : picked.assets[0];
  if (!asset) return null;
  const ext = extOf(asset.name);
  const allowed = ['txt', 'md', 'markdown', 'docx', ...('novelId' in target ? ['knchap'] : [])];
  if (!allowed.includes(ext))
    throw new Error(
      `“${asset.name}” can’t be imported. Choose a .txt, .md or .docx file${'novelId' in target ? ' (or a .knchap)' : ''}.`,
    );
  const bytes = await readAssetBytes(asset);
  if ('novelId' in target && extOf(asset.name) === 'knchap') {
    return importChapterArchive(repo, bytes, target);
  }
  const doc = await parseFile(asset.name, bytes);
  if (doc.blocks.length === 0) throw new Error('Nothing to import: the file has no text.');
  if ('novelId' in target) return addChapter(repo, doc, target.novelId, target.seasonId);
  const note = await createDoc(repo, target.folderId, {
    ...(doc.title ? { title: doc.title } : {}),
    blocks: doc.blocks,
  });
  await saveChapterStyles(repo, note.id, doc.styles);
  return note.id;
}
