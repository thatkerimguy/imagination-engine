// Notes → chapters: a note seen as a chapter-shaped draft (so the chapter editor components can
// edit it), and promotion of a note into a @kn/core-valid chapter of a novel.
import type { ChapterDocument } from '@kn/core';
import { captureRawText, loadChapterStyles, saveChapterStyles } from './chapter-styles.ts';
import { NotFoundError, ValidationError } from './errors.ts';
import { getDoc, UNTITLED, type DocRecord, type NoteBlock } from './folders.ts';
import { newSlugId } from './ids.ts';
import type { NovelRepository } from './repository.ts';
import { catalogResolver } from './blueprint-resolver.ts';
import { prepareChapter } from './sanitize.ts';

/** A note seen as a chapter-shaped draft, so the chapter editor components can edit it. */
export function docAsChapter(doc: DocRecord): ChapterDocument {
  return { id: doc.id, seasonId: 'notes', title: doc.title, status: 'draft', blocks: doc.blocks };
}

const isNoteBlock = (b: ChapterDocument['blocks'][number]): b is NoteBlock => b.kind !== 'module';

/**
 * Turns a note into the last chapter of a season. The note's blocks are cleaned and validated
 * with @kn/core (unfinished blocks are left out); the note itself is kept.
 */
export async function promoteDocToChapter(
  repo: NovelRepository,
  docId: string,
  novelId: string,
  seasonId: string,
): Promise<ChapterDocument> {
  const doc = await getDoc(repo, docId);
  if (!doc) throw new NotFoundError(`Document ${docId}`);
  const season = await repo.getSeason(novelId, seasonId);
  if (!season) throw new NotFoundError(`Season ${seasonId}`);
  const draft: ChapterDocument = {
    id: newSlugId(),
    seasonId,
    title: doc.title.trim() || UNTITLED,
    status: 'draft',
    blocks: doc.blocks.filter(isNoteBlock),
  };
  const prepared = prepareChapter(draft, await catalogResolver(repo.db, [draft]));
  if (!prepared.ok) throw new ValidationError('Chapter', prepared.errors);
  const { chapter } = await repo.saveChapter(novelId, prepared.chapter);
  await repo.saveSeason(novelId, { ...season, chapters: [...season.chapters, chapter.id] });
  const styles = await loadChapterStyles(repo, docId);
  await saveChapterStyles(repo, chapter.id, captureRawText(draft, styles));
  return chapter;
}
