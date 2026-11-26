// "Recent": a quiet, collapsible row of the last few chapters / notes the Author touched, one tap
// to resume. Hidden entirely when there is nothing yet. Self-loading; navigates itself.
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { relativeTime } from '../library/relative-time.ts';
import { routes } from '../routes.ts';
import { claimInnerHorizontal } from './root-tab.ts';
import { useRepoQuery } from '../store/context.tsx';
import { listAllDocs } from '../store/folders.ts';
import { isChapterKeyTrashed, trashedIds } from '../store/trash-model.ts';
import { loadAllItemMeta, type ItemMeta } from '../store/item-meta.ts';
import { isRedacted } from '../store/unlock-session.ts';
import type { NovelRepository } from '../store/repository.ts';
import { runAfterInteractions } from '../ui/after-interactions.ts';
import { Glyph } from '../ui/Glyph.tsx';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { radius, space } from '../ui/tokens.ts';
import { makeStyles } from '../ui/theme.tsx';

export interface RecentItem {
  id: string;
  kind: 'chapter' | 'doc';
  title: string;
  /** Book title for chapters, empty for notes. */
  book: string;
  /** max(updatedAt, lastOpenedAt). */
  at: number;
  locked: boolean;
  novelId?: string;
  seasonId?: string;
  folderId?: string | null;
}

export interface RecentInput {
  chapters: {
    novelId: string;
    seasonId: string;
    id: string;
    title: string;
    book: string;
    updatedAt: number;
  }[];
  docs: { id: string; title: string; folderId: string | null; updatedAt: number }[];
  meta: ReadonlyMap<string, ItemMeta>;
  /** Locked-and-not-unlocked predicate (defaults to `meta.locked`). */
  isLocked?(id: string): boolean;
}

/** The most recently edited / opened chapters and notes, newest first. Pure. */
export function recentItems(input: RecentInput, limit = 5): RecentItem[] {
  const at = (id: string, updatedAt: number): number =>
    Math.max(updatedAt, input.meta.get(id)?.lastOpenedAt ?? 0);
  const locked = input.isLocked ?? ((id: string) => input.meta.get(id)?.locked === true);
  const all: RecentItem[] = [
    ...input.chapters.map((c) => ({
      id: c.id,
      kind: 'chapter' as const,
      title: c.title,
      book: c.book,
      at: at(c.id, c.updatedAt),
      locked: locked(c.id),
      novelId: c.novelId,
      seasonId: c.seasonId,
    })),
    ...input.docs.map((d) => ({
      id: d.id,
      kind: 'doc' as const,
      title: d.title,
      book: '',
      at: at(d.id, d.updatedAt),
      locked: locked(d.id),
      folderId: d.folderId,
    })),
  ];
  return all.sort((a, b) => b.at - a.at).slice(0, limit);
}

export function openRecent(item: RecentItem): void {
  if (item.kind === 'chapter' && item.novelId && item.seasonId)
    router.push(routes.chapter(item.novelId, item.seasonId, item.id));
  else router.push(routes.note(item.id, item.folderId));
}

const useStyles = makeStyles((t) => ({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 36 },
  row: { gap: space.xs, paddingRight: space.gutter },
  tile: {
    width: 148,
    gap: 2,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs + 2,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.hairline,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
  grow: { flex: 1 },
}));

/** Last result: shown instantly on remount while the disk refresh waits for the UI to go idle. */
let cached: RecentItem[] | undefined;
let pendingRefresh: { cancel(): void } | null = null;

function loadRecent(repo: NovelRepository): Promise<RecentItem[]> {
  if (!cached) return readRecent(repo).then((items) => (cached = items));
  return new Promise((resolve, reject) => {
    pendingRefresh = runAfterInteractions(() => {
      pendingRefresh = null;
      readRecent(repo).then((items) => resolve((cached = items)), reject);
    });
  });
}

async function readRecent(repo: NovelRepository): Promise<RecentItem[]> {
  const chapters: RecentInput['chapters'] = [];
  const books = new Map<string, string>();
  const trashed = await trashedIds(repo.docs);
  for (const key of await repo.docs.keys('chapter/')) {
    const [, novelId, seasonId, id] = key.split('/');
    if (!novelId || !seasonId || !id || isChapterKeyTrashed(key, trashed)) continue;
    const stored = await repo.docs.read<{ title: string }>(key);
    if (!stored) continue;
    if (!books.has(novelId)) books.set(novelId, (await repo.getNovel(novelId))?.title ?? '');
    chapters.push({
      novelId,
      seasonId,
      id,
      title: stored.data.title,
      book: books.get(novelId) ?? '',
      updatedAt: stored.updatedAt,
    });
  }
  const docs = (await listAllDocs(repo)).map((d) => ({
    id: d.id,
    title: d.title,
    folderId: d.parentFolderId,
    updatedAt: d.updatedAt,
  }));
  const meta = await loadAllItemMeta(repo);
  return recentItems({ chapters, docs, meta, isLocked: (id) => isRedacted(id, meta.get(id)) });
}

export function RecentStrip({ testID = 'recent-strip' }: { testID?: string }): ReactNode {
  const s = useStyles();
  const [open, setOpen] = useState(true);
  const query = useRepoQuery('recent-strip', loadRecent);
  useEffect(
    () => () => {
      pendingRefresh?.cancel();
      pendingRefresh = null;
    },
    [],
  );
  const data = query.data ?? cached;
  if (!data || data.length === 0) return null;
  return (
    <View testID={testID}>
      <Press
        onPress={() => setOpen((o) => !o)}
        wash={null}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Collapse recent' : 'Expand recent'}
        accessibilityState={{ expanded: open }}
        style={s.head}
        testID="recent-toggle"
      >
        <Txt variant="overline" color="inkSecondary">
          Recent
        </Txt>
        <Glyph name={open ? 'chevron-down' : 'chevron-right'} size={14} color="inkMuted" />
      </Press>
      {open ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.row}
          // The carousel owns horizontal drags inside its bounds; the root pager stands aside.
          onTouchStart={claimInnerHorizontal}
        >
          {data.map((item) => (
            <Press
              key={`${item.kind}:${item.id}`}
              onPress={() => openRecent(item)}
              accessibilityRole="button"
              accessibilityLabel={`Resume ${item.title}`}
              style={s.tile}
              testID={`recent-tile-${item.id}`}
            >
              <View style={s.titleRow}>
                {item.locked ? <Glyph name="lock" size={12} color="inkMuted" /> : null}
                <Txt variant="bodyStrong" numberOfLines={1} style={s.grow}>
                  {item.title}
                </Txt>
              </View>
              <Txt variant="caption" color="inkMuted" numberOfLines={1}>
                {[item.kind === 'chapter' ? item.book || 'Chapter' : 'Note', relativeTime(item.at)]
                  .filter(Boolean)
                  .join(' · ')}
              </Txt>
            </Press>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
