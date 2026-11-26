// Whole-book import: validates every document, then writes the book, its seasons and chapters
// (bodies, search text, @mention links) in ONE atomic node write, and records day-0 growth
// baselines so imported words never count as "written today".
import {
  parseNovelManifest,
  parseSeasonManifest,
  SCHEMA_VERSION,
  type SectionLabel,
  type ChapterDocument,
  type NovelManifest,
  type SeasonManifest,
  type WorkspaceMode,
} from '@kn/core';
import type { NodeWrite } from '../db/port.ts';
import { ValidationError } from './errors.ts';
import { countsOf } from './growth-logger.ts';
import { newSlugId } from './ids.ts';
import { recordBaseline } from './growth-store.ts';
import { bookNode, chapterNode, seasonNode } from './node-mapping.ts';
import { check, type NovelRepository } from './repository.ts';
import { mentionLinks } from './repository-writes.ts';
import { prepareChapter } from './sanitize.ts';

export interface SeasonBundle {
  season: SeasonManifest;
  chapters: ChapterDocument[];
}

/** A whole book as plain JSON: the export format and the demo import format. */
export interface NovelBundle {
  novel: NovelManifest;
  seasons: SeasonBundle[];
  /** Per-book workspace mode (default: kept, or `prose` for a new book). */
  workspaceMode?: WorkspaceMode;
}

export interface NewNovelInput {
  title: string;
  subtitle?: string;
  author: string;
  sectionLabel: SectionLabel;
  workspaceMode?: WorkspaceMode;
}

/** A new book: one season and an empty first chapter, ready to write in (`prose` by default). */
export function newNovelBundle(input: NewNovelInput): NovelBundle {
  const [novelId, seasonId, chapterId] = [newSlugId(), newSlugId(), newSlugId()];
  const novel: NovelManifest = {
    schemaVersion: SCHEMA_VERSION,
    id: novelId,
    title: input.title.trim(),
    ...(input.subtitle?.trim() ? { subtitle: input.subtitle.trim() } : {}),
    author: input.author.trim(),
    sectionLabel: input.sectionLabel,
    theme: {},
    enabledModules: [],
    seasons: [seasonId],
  };
  const season = { id: seasonId, title: `${input.sectionLabel} 1`, chapters: [chapterId] };
  const chapter: ChapterDocument = {
    id: chapterId,
    seasonId,
    title: 'Chapter 1',
    status: 'draft',
    blocks: [],
  };
  return {
    novel,
    seasons: [{ season, chapters: [chapter] }],
    workspaceMode: input.workspaceMode ?? 'prose',
  };
}

export async function importBundleInto(repo: NovelRepository, bundle: NovelBundle): Promise<void> {
  const novel = check('Novel', parseNovelManifest(bundle.novel));
  const seasons = bundle.seasons.map((s) => ({
    season: check(`Season ${s.season.id}`, parseSeasonManifest(s.season)),
    chapters: s.chapters.map((c) => {
      const p = prepareChapter(c);
      if (!p.ok) throw new ValidationError(`Chapter ${c.id}`, p.errors);
      return p.chapter;
    }),
  }));
  const db = repo.db;
  const now = repo.nowIso();
  const existing = await db.getNode(novel.id);
  if (existing && existing.kind !== 'book') throw new ValidationError('Novel', ['Id in use']);
  const writes: NodeWrite[] = [{ node: bookNode(novel, existing, now, bundle.workspaceMode) }];
  const order = new Map(novel.seasons.map((id, i) => [id, i]));
  const fresh: ChapterDocument[] = [];
  for (const [si, { season, chapters }] of seasons.entries()) {
    const prev = await db.getNode(season.id);
    const position = order.get(season.id) ?? novel.seasons.length + si;
    writes.push({ node: seasonNode(season, novel.id, prev, position, now) });
    const chapterOrder = new Map(season.chapters.map((id, i) => [id, i]));
    for (const [ci, c] of chapters.entries()) {
      const before = await db.getNode(c.id);
      if (!before) fresh.push(c);
      const at = chapterOrder.get(c.id) ?? season.chapters.length + ci;
      const { node, body } = chapterNode(c, novel.id, before, at, now);
      writes.push({ node, body });
    }
  }
  for (const w of writes)
    if (w.body) w.links = await mentionLinks(db, w.node.id, w.body.plainText, now);
  await db.putNodes(writes);
  const total = seasons.flatMap((s) => s.chapters).map(countsOf);
  const sum = total.reduce(
    (a, c) => ({
      chars: a.chars + c.chars,
      words: a.words + c.words,
      sentences: a.sentences + c.sentences,
      paragraphs: a.paragraphs + c.paragraphs,
    }),
    { chars: 0, words: 0, sentences: 0, paragraphs: 0 },
  );
  await recordBaseline(repo, [
    ...fresh.map((c) => ({ nodeId: c.id, counts: countsOf(c) })),
    { nodeId: novel.id, counts: sum },
  ]);
}
