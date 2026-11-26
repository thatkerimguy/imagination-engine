// The writer's single source of truth over the v2 relational node tree: books, seasons, chapters
// (and, via folders.ts, the Notes workspace). Speaks @kn/core v1 documents to the rest of the
// app; every write is validated with @kn/core first, so storage never holds an invalid document.
// Reading order = sibling `position`; trashed nodes (`deletedAt`) drop out of every active list.
import {
  parseNovelManifest,
  parseSeasonManifest,
  type ChapterDocument,
  type NodeRecord,
  type NovelManifest,
  type ParseResult,
  type SeasonManifest,
  type WorkspaceMode,
} from '@kn/core';
import type { DatabasePort } from '../db/port.ts';
import { settingsAdapter } from '../db/settings-adapter.ts';
import { DocumentStore } from './documents.ts';
import { NotFoundError, ValidationError } from './errors.ts';
import { bookNode, ms, seasonNode, toChapter, toManifest, toSeason } from './node-mapping.ts';
import {
  importBundleInto,
  newNovelBundle,
  type NewNovelInput,
  type NovelBundle,
} from './repository-bundle.ts';
import { chapterWrite, nextPosition } from './repository-writes.ts';
import { prepareChapter } from './sanitize.ts';
import { summarizeNovels, type NovelSummary } from './novel-summary.ts';

export type { NovelSummary } from './novel-summary.ts';
export type { NovelBundle, SeasonBundle } from './repository-bundle.ts';

export type { NewNovelInput } from './repository-bundle.ts';

export interface ChapterSaveResult {
  chapter: ChapterDocument;
  skipped: string[];
  updatedAt: number;
}

type Listener = () => void;

export function check<T>(what: string, result: ParseResult<T>): T {
  if (!result.ok) throw new ValidationError(what, result.errors);
  return result.value;
}

export class NovelRepository {
  /** Settings-table sidecars (item meta, styles, versions, prefs) as JSON documents. */
  readonly docs: DocumentStore;
  private readonly listeners = new Set<Listener>();

  constructor(
    readonly db: DatabasePort,
    readonly now: () => number = Date.now,
    /** Document-directory URI that relative media paths resolve against ('' on web / tests). */
    readonly mediaRoot = '',
  ) {
    this.docs = new DocumentStore(settingsAdapter(db), now);
  }

  nowIso(): string {
    return new Date(this.now()).toISOString();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  protected changed(): void {
    for (const l of this.listeners) l();
  }

  /** For stores that write through `db` / `docs` directly (folders, trash, item meta). */
  notifyChanged(): void {
    this.changed();
  }

  /** Active children of a node in reading order. */
  children(parentId: string, kind: NodeRecord['kind']): Promise<NodeRecord[]> {
    return this.db.listNodes({ parentId, kinds: [kind] });
  }

  private async kindNode(id: string, kind: NodeRecord['kind']): Promise<NodeRecord | null> {
    const n = await this.db.getNode(id);
    return n && n.kind === kind ? n : null;
  }

  // ── Novels ──────────────────────────────────────────────────────────────────────────────

  async listNovels(): Promise<NovelSummary[]> {
    return summarizeNovels(this, await this.db.listNodes({ parentId: null, kinds: ['book'] }));
  }

  async getNovel(novelId: string): Promise<NovelManifest | null> {
    const node = await this.kindNode(novelId, 'book');
    if (!node) return null;
    return toManifest(
      node,
      (await this.children(novelId, 'season')).map((s) => s.id),
    );
  }

  async requireNovel(novelId: string): Promise<NovelManifest> {
    const novel = await this.getNovel(novelId);
    if (!novel) throw new NotFoundError(`Novel ${novelId}`);
    return novel;
  }

  /** Saves the manifest; `seasons` reorders the book's active seasons. */
  async saveNovel(manifest: NovelManifest): Promise<NovelManifest> {
    const novel = check('Novel', parseNovelManifest(manifest));
    const existing = await this.kindNode(novel.id, 'book');
    const now = this.nowIso();
    const writes = [{ node: bookNode(novel, existing, now) }];
    const order = new Map(novel.seasons.map((id, i) => [id, i]));
    for (const s of await this.children(novel.id, 'season')) {
      const at = order.get(s.id);
      if (at !== undefined && at !== s.position) writes.push({ node: { ...s, position: at } });
    }
    await this.db.putNodes(writes);
    this.changed();
    return novel;
  }

  /** Creates the book with a first season and an empty first chapter, ready to write in. */
  async createNovel(input: NewNovelInput): Promise<NovelManifest> {
    const bundle = newNovelBundle(input);
    await this.importBundle(bundle);
    return bundle.novel;
  }

  /** Deletes a book for good; ON DELETE CASCADE removes everything inside it. */
  async deleteNovel(novelId: string): Promise<void> {
    await this.db.deleteNodes([novelId]);
    this.changed();
  }

  async getWorkspaceMode(bookId: string): Promise<WorkspaceMode> {
    return (await this.kindNode(bookId, 'book'))?.workspaceMode ?? 'prose';
  }

  /** Toggles a book between clean prose and interactive (kinetic) authoring. */
  async setWorkspaceMode(bookId: string, mode: WorkspaceMode): Promise<void> {
    const node = await this.kindNode(bookId, 'book');
    if (!node) throw new NotFoundError(`Novel ${bookId}`);
    await this.db.putNodes([{ node: { ...node, workspaceMode: mode, updatedAt: this.nowIso() } }]);
    this.changed();
  }

  // ── Seasons ─────────────────────────────────────────────────────────────────────────────

  async getSeason(novelId: string, seasonId: string): Promise<SeasonManifest | null> {
    const node = await this.kindNode(seasonId, 'season');
    if (!node || node.parentId !== novelId) return null;
    return toSeason(
      node,
      (await this.children(seasonId, 'chapter')).map((c) => c.id),
    );
  }

  /** Active seasons in the novel's reading order. */
  async listSeasons(novelId: string): Promise<SeasonManifest[]> {
    await this.requireNovel(novelId);
    const out: SeasonManifest[] = [];
    for (const s of await this.children(novelId, 'season'))
      out.push(
        toSeason(
          s,
          (await this.children(s.id, 'chapter')).map((c) => c.id),
        ),
      );
    return out;
  }

  /** Saves the manifest; `chapters` reorders the season's active chapters. */
  async saveSeason(novelId: string, manifest: SeasonManifest): Promise<SeasonManifest> {
    const season = check('Season', parseSeasonManifest(manifest));
    if (!(await this.kindNode(novelId, 'book'))) throw new NotFoundError(`Novel ${novelId}`);
    const existing = await this.kindNode(season.id, 'season');
    const position = existing?.position ?? (await nextPosition(this.db, novelId));
    const writes = [{ node: seasonNode(season, novelId, existing, position, this.nowIso()) }];
    const order = new Map(season.chapters.map((id, i) => [id, i]));
    for (const c of await this.children(season.id, 'chapter')) {
      const at = order.get(c.id);
      if (at !== undefined && at !== c.position) writes.push({ node: { ...c, position: at } });
    }
    await this.db.putNodes(writes);
    this.changed();
    return season;
  }

  // ── Chapters ────────────────────────────────────────────────────────────────────────────

  async getChapter(
    novelId: string,
    seasonId: string,
    chapterId: string,
  ): Promise<ChapterDocument | null> {
    const node = await this.kindNode(chapterId, 'chapter');
    if (!node || node.parentId !== seasonId || node.bookId !== novelId) return null;
    return toChapter(node, await this.db.getBody(chapterId));
  }

  /** Active chapters in the season's reading order. */
  async listChapters(novelId: string, seasonId: string): Promise<ChapterDocument[]> {
    const season = await this.kindNode(seasonId, 'season');
    if (!season || season.parentId !== novelId) throw new NotFoundError(`Season ${seasonId}`);
    const out: ChapterDocument[] = [];
    for (const c of await this.children(seasonId, 'chapter'))
      out.push(toChapter(c, await this.db.getBody(c.id)));
    return out;
  }

  /**
   * Cleans and validates a draft (unfinished blocks are left out, see sanitize.ts), refreshes
   * its search text and @mention links, and records a day-0 growth baseline for a new chapter.
   */
  async saveChapter(novelId: string, draft: ChapterDocument): Promise<ChapterSaveResult> {
    const prepared = prepareChapter(draft);
    if (!prepared.ok) throw new ValidationError('Chapter', prepared.errors);
    const { chapter, skipped } = prepared;
    const season = await this.kindNode(chapter.seasonId, 'season');
    if (!season || season.parentId !== novelId)
      throw new NotFoundError(`Season ${chapter.seasonId}`);
    const write = await chapterWrite(this, novelId, chapter);
    await this.db.putNodes([write.entry]);
    await write.afterCommit();
    this.changed();
    return { chapter, skipped, updatedAt: ms(write.entry.node.updatedAt) };
  }

  // ── Bundles (import / export) ───────────────────────────────────────────────────────────

  /** Validates every document before writing any of them; one atomic write. */
  async importBundle(bundle: NovelBundle): Promise<void> {
    await importBundleInto(this, bundle);
    this.changed();
  }

  async exportNovel(novelId: string): Promise<NovelBundle> {
    const novel = check('Novel', parseNovelManifest(await this.requireNovel(novelId)));
    const seasons = [];
    for (const season of await this.listSeasons(novelId))
      seasons.push({ season, chapters: await this.listChapters(novelId, season.id) });
    return { novel, seasons, workspaceMode: await this.getWorkspaceMode(novelId) };
  }
}
