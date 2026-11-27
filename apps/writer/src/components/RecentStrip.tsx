// "Recent": a quiet, collapsible row of the last few chapters / notes the Author touched, one tap
// to resume. Hidden entirely when there is nothing yet. Self-loading; navigates itself.
import { router } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { relativeTime } from '../library/relative-time.ts';
import { routes } from '../routes.ts';
import { claimInnerHorizontal } from './root-tab.ts';
import { useRepoQuery } from '../store/context.tsx';
import { listAllDocs } from '../store/folders.ts';
import { hiddenNodeIds } from '../store/trash-model.ts';
import { loadAllItemMeta } from '../store/item-meta.ts';
import { recentItems, type RecentInput, type RecentItem } from './recent-items.ts';
import { isRedacted } from '../store/unlock-session.ts';
import type { NovelRepository } from '../store/repository.ts';
import { runAfterInteractions } from '../ui/after-interactions.ts';
import { Glyph } from '../ui/Glyph.tsx';
import { NODE_KIND_META } from '../ui/node-kind.ts';
import { MIN_TOUCH } from '../ui/a11y.ts';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { radius, space } from '../ui/tokens.ts';
import { makeStyles } from '../ui/theme.tsx';

/** Icon + label key of a Recent tile (chapters, or the doc's story kind). */
export const recentKind = (item: Pick<RecentItem, 'kind' | 'docKind'>) =>
  NODE_KIND_META[item.kind === 'chapter' ? 'chapter' : (item.docKind ?? 'note')];

export function openRecent(item: RecentItem): void {
  if (item.kind === 'chapter' && item.novelId && item.seasonId)
    router.push(routes.chapter(item.novelId, item.seasonId, item.id));
  else router.push(routes.note(item.id, item.folderId));
}

const useStyles = makeStyles((t) => ({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: MIN_TOUCH },
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
  const all = await repo.db.listNodes({ includeDeleted: true });
  const hidden = hiddenNodeIds(all);
  for (const n of all) if (n.kind === 'book') books.set(n.id, n.title);
  for (const n of all) {
    if (n.kind !== 'chapter' || hidden.has(n.id) || !n.bookId || !n.parentId) continue;
    chapters.push({
      novelId: n.bookId,
      seasonId: n.parentId,
      id: n.id,
      title: n.title,
      book: books.get(n.bookId) ?? '',
      updatedAt: Date.parse(n.updatedAt) || 0,
    });
  }
  const docs = (await listAllDocs(repo)).map((d) => ({
    id: d.id,
    title: d.title,
    folderId: d.parentFolderId,
    updatedAt: d.updatedAt,
    kind: d.kind,
  }));
  const meta = await loadAllItemMeta(repo);
  return recentItems({ chapters, docs, meta, isLocked: (id) => isRedacted(id, meta.get(id)) });
}

export function RecentStrip({ testID = 'recent-strip' }: { testID?: string }): ReactNode {
  const s = useStyles();
  const { t, locale } = useI18n();
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
        accessibilityLabel={open ? t('recent.collapse') : t('recent.expand')}
        accessibilityState={{ expanded: open }}
        style={s.head}
        testID="recent-toggle"
      >
        <Txt variant="overline" color="inkSecondary">
          {t('recent.title')}
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
              accessibilityLabel={t('recent.resume', { title: item.title })}
              style={s.tile}
              testID={`recent-tile-${item.id}`}
            >
              <View style={s.titleRow}>
                <Glyph name={recentKind(item).icon} size={12} color="inkMuted" />
                {item.locked ? <Glyph name="lock" size={12} color="inkMuted" /> : null}
                <Txt variant="bodyStrong" numberOfLines={1} style={s.grow}>
                  {item.title}
                </Txt>
              </View>
              <Txt variant="caption" color="inkMuted" numberOfLines={1}>
                {[
                  item.kind === 'chapter'
                    ? item.book || t('kind.chapter')
                    : t(recentKind(item).labelKey),
                  relativeTime(item.at, Date.now(), locale),
                ]
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
