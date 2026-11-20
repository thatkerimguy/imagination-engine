// Builds the exact message the reader preview renders: the novel and season from storage and
// the chapter from the editor's live (unsaved) draft when one is open.
import type { NovelManifest, SeasonManifest } from '@kn/core';
import { loadSettings, previewUrl } from '../settings/app-settings.ts';
import { useRepoQuery } from '../store/context.tsx';
import { draftKey, getLiveDraft } from '../store/live-drafts.ts';
import { prepareChapter } from '../store/sanitize.ts';
import type { PreviewLoadMessage, PreviewTier } from './protocol.ts';

export interface PreviewPayload {
  url: string | null;
  readerUrl: string;
  build(tier: PreviewTier): PreviewLoadMessage;
  /** True when the chapter came from the open editor rather than storage. */
  fromLiveDraft: boolean;
}

export type PreviewData = { ok: true; payload: PreviewPayload } | { ok: false; errors: string[] };

export function usePreviewPayload(
  novelId: string,
  seasonId: string,
  chapterId: string,
  blockId: string | undefined,
) {
  return useRepoQuery<PreviewData>(
    `${novelId}/${seasonId}/${chapterId}/${blockId ?? ''}`,
    async (repo) => {
      const [settings, novel, season, stored] = await Promise.all([
        loadSettings(repo),
        repo.getNovel(novelId),
        repo.getSeason(novelId, seasonId),
        repo.getChapter(novelId, seasonId, chapterId),
      ]);
      const live = getLiveDraft(draftKey(novelId, seasonId, chapterId));
      const draft = live ?? stored;
      if (!novel || !season || !draft)
        return { ok: false, errors: ['This chapter no longer exists.'] };
      const prepared = prepareChapter(draft);
      if (!prepared.ok) return { ok: false, errors: prepared.errors };
      const chapter = prepared.chapter;
      const startBlockId =
        blockId && chapter.blocks.some((b) => b.id === blockId) ? blockId : undefined;
      const n: NovelManifest = novel;
      const s: SeasonManifest = season;
      return {
        ok: true,
        payload: {
          url: previewUrl(settings.readerUrl),
          readerUrl: settings.readerUrl,
          fromLiveDraft: !!live,
          build: (tier) => ({
            type: 'kn-preview-load',
            novel: n,
            season: s,
            chapter,
            tier,
            ...(startBlockId ? { startBlockId } : {}),
          }),
        },
      };
    },
  );
}
