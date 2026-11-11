import { compileStory, type PlaytestReport } from '@ie/story';
import { useMemo, useState } from 'react';
import { PlaytestPanel } from '../publish/PlaytestPanel.tsx';
import { PublishChecks } from '../publish/PublishChecks.tsx';
import { useDoc } from '../project/store.ts';
import { useT } from '../store.ts';

/** Publish (ADR 0022): the auto-playtester, the publish check, credits, and the novel file. */
export function PublishView() {
  const t = useT();
  const doc = useDoc();
  const story = useMemo(() => compileStory(doc, { allowErrors: true }), [doc]);
  // A report belongs to the story it was made from; an edit makes it stale.
  const [result, setResult] = useState<{ story: typeof story; report: PlaytestReport } | null>(
    null,
  );
  const report = result?.story === story ? result.report : null;

  return (
    <section className="page" data-testid="view-publish">
      <h2 className="page__title">{t('view.publish')}</h2>
      <p className="page__intro">{t('pub.intro')}</p>
      <PlaytestPanel
        story={story}
        report={report}
        onReport={(r) => setResult(r ? { story, report: r } : null)}
      />
      <PublishChecks doc={doc} story={story} playtest={report} />
    </section>
  );
}
