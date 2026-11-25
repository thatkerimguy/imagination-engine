// "Publish to web": pre-flight ledger, one-tap publish to the author's own publish API, share links
// and unpublish. Drafts always stay private.
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { routes } from '../routes.ts';
import { ActionButton } from '../ui/ActionButton.tsx';
import { successFeedback } from '../ui/haptics.ts';
import { CardGroup } from '../ui/CardGroup.tsx';
import { useConfirm } from '../ui/ConfirmDialog.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { ListRow, SectionLabel } from '../ui/Page.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';

import { chapterUrl, publicNovelUrl } from './publish-links.ts';
import { termsUrl } from './publish-settings.ts';
import { PublishTosGate } from './PublishTosGate.tsx';
import { Banner, CopyRow, LedgerRow, relativeTime } from './ui-publish-parts.tsx';
import { usePublish } from './use-publish.ts';

export interface PublishSheetProps {
  visible: boolean;
  novelId: string;
  onClose(): void;
  /** Flush autosave before the book is read for publishing. */
  beforePublish?: () => Promise<void>;
}

export function PublishSheet(p: PublishSheetProps): ReactNode {
  const confirm = useConfirm();
  const s = usePublish(p.visible, p.novelId, p.beforePublish);
  const { plan, status, config } = s;

  const openSettings = (): void => {
    p.onClose();
    router.push(routes.appSettings);
  };
  const publish = async (): Promise<void> => {
    if (await s.publish()) successFeedback();
  };
  const unpublish = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Unpublish from web',
      message: 'Remove this book from the web? Readers with a link will no longer see it.',
      confirmLabel: 'Unpublish',
      destructive: true,
    });
    if (ok) await s.unpublish();
  };

  const published = status?.publishedChapters ?? 0;
  const unlisted = plan?.unlistedItems ?? [];
  const showLinks = Boolean(config.readerUrl) && Boolean(status?.lastPublishedAt);

  return (
    <Sheet visible={p.visible} title="Publish to web" onClose={p.onClose} testID="publish-sheet">
      {s.ready === false ? (
        <View style={styles.stack}>
          <Txt variant="body" color="inkSecondary">
            Publish this book to the web in one tap. It goes to your own Cloudflare R2 through your
            publish API, and drafts always stay private.
          </Txt>
          <ActionButton
            label="Open Publishing Settings"
            variant="secondary"
            onPress={openSettings}
            testID="publish-open-settings"
          />
        </View>
      ) : null}
      {s.ready ? (
        <>
          <CardGroup testID="publish-ledger">
            <LedgerRow
              tone="success"
              title="Published"
              count={plan?.publishedChapters ?? 0}
              testID="publish-count-published"
            />
            <LedgerRow
              tone="warm"
              title="Unlisted"
              count={plan?.unlistedChapters ?? 0}
              testID="publish-count-unlisted"
            />
            <LedgerRow
              tone="inkMuted"
              title="Drafts (kept private)"
              count={plan?.draftChapters ?? 0}
              testID="publish-count-drafts"
            />
            <ListRow
              title="Last published"
              detail={relativeTime(status?.lastPublishedAt ?? null)}
              last
            />
          </CardGroup>
          {plan?.warnings.map((w) => (
            <Txt key={w} variant="meta" color="inkSecondary">
              {w}
            </Txt>
          ))}
          {s.published ? <Banner text={`Published ${s.published}`} testID="publish-toast" /> : null}
          {s.error ? (
            <Txt variant="meta" color="danger" testID="publish-error">
              {s.error}
            </Txt>
          ) : null}
          {s.note ? (
            <Txt variant="meta" color="inkSecondary" testID="publish-note">
              {s.note}
            </Txt>
          ) : null}
          {s.tosAccepted === false ? (
            <PublishTosGate termsUrl={termsUrl(config)} onAccept={s.acceptTerms} />
          ) : null}
          <ActionButton
            label={s.busy ? 'Working…' : 'Publish now'}
            icon="upload-cloud"
            disabled={s.busy || !plan || s.tosAccepted !== true}
            onPress={() => void publish()}
            testID="publish-now"
          />
          {showLinks ? (
            <View style={styles.stack}>
              <SectionLabel>Share</SectionLabel>
              <CardGroup>
                {published > 0 ? (
                  <CopyRow
                    title="Copy public link"
                    url={publicNovelUrl(config.readerUrl, p.novelId)}
                    testID="publish-copy-public"
                    last={unlisted.length === 0}
                  />
                ) : null}
                {unlisted.map((u, i) => (
                  <CopyRow
                    key={u.chapterId}
                    title={`Copy unlisted link · ${u.title}`}
                    url={chapterUrl(config.readerUrl, p.novelId, u.seasonId, u.chapterId)}
                    testID={`publish-copy-unlisted-${u.chapterId}`}
                    last={i === unlisted.length - 1}
                  />
                ))}
              </CardGroup>
            </View>
          ) : null}
          {status ? (
            <CardGroup>
              <ListRow
                icon="trash-2"
                title="Unpublish from web"
                destructive
                last
                testID="publish-unpublish"
                onPress={() => void unpublish()}
              />
            </CardGroup>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
});
