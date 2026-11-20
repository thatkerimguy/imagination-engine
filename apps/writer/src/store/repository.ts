// The writer's single source of truth: books, seasons, chapters and their ordered blocks.
// Every write is validated with @kn/core first, so storage never holds an invalid document.
import {
  parseNovelManifest,
  parseSeasonManifest,
  SCHEMA_VERSION,
  type ChapterDocument,
  type NovelManifest,
  type ParseResult,
  type SeasonManifest,
  type SectionLabel,
} from '@kn/core';
import type { StorageAdapter } from '../storage/types.ts';
import { DocumentStore, keys } from './documents.ts';
import { NotFoundError, ValidationError } from './errors.ts';
import { newSlugId } from './ids.ts';
import { prepareChapter } from './sanitize.ts';
import { summarizeNovel, type NovelSummary } from './novel-summary.ts';

export type { NovelSummary } from './novel-summary.ts';

export interface NewNovelInput {
  title: string;
  subtitle?: string;
  author: string;
  sectionLabel: SectionLabel;
}

export interface SeasonBundle {
  season: SeasonManifest;
  chapters: ChapterDocument[];
}

/** A whole book as plain JSON: the export format and the demo import format. */
export interface NovelBundle {
  novel: NovelManifest;
  seasons: SeasonBundle[];
}

export interface ChapterSaveResult {
  chapter: ChapterDocument;
  skipped: string[];
  updatedAt: number;
}

type Listener = () => void;

function check<T>(what: string, result: ParseResult<T>): T {
  if (!result.ok) throw new ValidationError(what, result.errors);
  return result.value;
}

export class NovelRepository {
  readonly docs: DocumentStore;
  private readonly listeners = new Set<Listener>();

  constructor(adapter: StorageAdapter, now: () => number = Date.now) {
    this.docs = new DocumentStore(adapter, now);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  protected changed(): void {
    for (const l of this.listeners) l();
  }

  /** For writer-only sidecar stores (folders, notes, item meta) that write through `docs`. */
  notifyChanged(): void {
    this.changed();
  }

  // ── Novels ──────────────────────────────────────────────────────────────────────────────

  async listNovels(): Promise<NovelSummary[]> {
    const out: NovelSummary[] = [];
    for (const key of await this.docs.keys('novel/')) {
      const stored = await this.docs.read<NovelManifest>(key);
      if (stored) out.push(await summarizeNovel(this.docs, stored));
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getNovel(novelId: string): Promise<NovelManifest | null> {
    return (await this.docs.read<NovelManifest>(keys.novel(novelId)))?.data ?? null;
  }

  async requireNovel(novelId: string): Promise<NovelManifest> {
    const novel = await this.getNovel(novelId);
    if (!novel) throw new NotFoundError(`Novel ${novelId}`);
    return novel;
  }

  async saveNovel(manifest: NovelManifest): Promise<NovelManifest> {
    const novel = check('Novel', parseNovelManifest(manifest));
    await this.docs.write(keys.novel(novel.id), novel);
    this.changed();
    return novel;
  }

  /** Creates the book with a first season and an empty first chapter, ready to write in. */
  async createNovel(input: NewNovelInput): Promise<NovelManifest> {
    const novelId = newSlugId();
    const seasonId = newSlugId();
    const chapterId = newSlugId();
    const season: SeasonManifest = {
      id: seasonId,
      title: `${input.sectionLabel} 1`,
      chapters: [chapterId],
    };
    const chapter: ChapterDocument = {
      id: chapterId,
      seasonId,
      title: 'Chapter 1',
      status: 'draft',
      blocks: [],
    };
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
    await this.importBundle({ novel, seasons: [{ season, chapters: [chapter] }] });
    return novel;
  }

  async deleteNovel(novelId: string): Promise<void> {
    const all = [
      keys.novel(novelId),
      ...(await this.docs.keys(keys.seasonsOf(novelId))),
      ...(await this.docs.keys(keys.chaptersOf(novelId))),
    ];
    for (const k of all) await this.docs.remove(k);
    this.changed();
  }

  // ── Seasons ─────────────────────────────────────────────────────────────────────────────

  async getSeason(novelId: string, seasonId: string): Promise<SeasonManifest | null> {
    return (await this.docs.read<SeasonManifest>(keys.season(novelId, seasonId)))?.data ?? null;
  }

  /** Seasons in the novel's reading order. */
  async listSeasons(novelId: string): Promise<SeasonManifest[]> {
    const novel = await this.requireNovel(novelId);
    const seasons = await Promise.all(novel.seasons.map((id) => this.getSeason(novelId, id)));
    return seasons.filter((s): s is SeasonManifest => s !== null);
  }

  async saveSeason(novelId: string, manifest: SeasonManifest): Promise<SeasonManifest> {
    const season = check('Season', parseSeasonManifest(manifest));
    await this.docs.write(keys.season(novelId, season.id), season);
    this.changed();
    return season;
  }

  // ── Chapters ────────────────────────────────────────────────────────────────────────────

  async getChapter(
    novelId: string,
    seasonId: string,
    chapterId: string,
  ): Promise<ChapterDocument | null> {
    const key = keys.chapter(novelId, seasonId, chapterId);
    return (await this.docs.read<ChapterDocument>(key))?.data ?? null;
  }

  /** Chapters in the season's reading order. */
  async listChapters(novelId: string, seasonId: string): Promise<ChapterDocument[]> {
    const season = await this.getSeason(novelId, seasonId);
    if (!season) throw new NotFoundError(`Season ${seasonId}`);
    const chapters = await Promise.all(
      season.chapters.map((id) => this.getChapter(novelId, seasonId, id)),
    );
    return chapters.filter((c): c is ChapterDocument => c !== null);
  }

  /** Cleans and validates a draft; unfinished blocks are left out (see sanitize.ts). */
  async saveChapter(novelId: string, draft: ChapterDocument): Promise<ChapterSaveResult> {
    const prepared = prepareChapter(draft);
    if (!prepared.ok) throw new ValidationError('Chapter', prepared.errors);
    const { chapter, skipped } = prepared;
    const updatedAt = await this.docs.write(
      keys.chapter(novelId, chapter.seasonId, chapter.id),
      chapter,
    );
    this.changed();
    return { chapter, skipped, updatedAt };
  }

  // ── Bundles (import / export) ───────────────────────────────────────────────────────────

  /** Validates every document before writing any of them. */
  async importBundle(bundle: NovelBundle): Promise<void> {
    const novel = check('Novel', parseNovelManifest(bundle.novel));
    const seasons = bundle.seasons.map((s) => ({
      season: check(`Season ${s.season.id}`, parseSeasonManifest(s.season)),
      chapters: s.chapters.map((c) => {
        const p = prepareChapter(c);
        if (!p.ok) throw new ValidationError(`Chapter ${c.id}`, p.errors);
        return p.chapter;
      }),
    }));
    await this.docs.write(keys.novel(novel.id), novel);
    for (const { season, chapters } of seasons) {
      await this.docs.write(keys.season(novel.id, season.id), season);
      for (const c of chapters) await this.docs.write(keys.chapter(novel.id, season.id, c.id), c);
    }
    this.changed();
  }

  async exportNovel(novelId: string): Promise<NovelBundle> {
    const novel = check('Novel', parseNovelManifest(await this.requireNovel(novelId)));
    const seasons: SeasonBundle[] = [];
    for (const season of await this.listSeasons(novelId)) {
      seasons.push({ season, chapters: await this.listChapters(novelId, season.id) });
    }
    return { novel, seasons };
  }
}
