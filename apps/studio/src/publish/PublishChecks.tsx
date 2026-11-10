import {
  buildCredits,
  publicBuild,
  publishCheck,
  type CompiledStory,
  type PlaytestReport,
  type PublishTarget,
  type StoryProject,
} from '@ie/story';
import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import { upper } from '@ie/i18n';
import { Segmented } from '../components/Segmented.tsx';
import type { MessageKey } from '../messages.ts';
import { useT } from '../store.ts';

function fileName(doc: StoryProject, target: PublishTarget): string {
  const name = (doc.title.en || doc.title.tr || 'novel')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .toLowerCase();
  return `${name}${target === 'private' ? '.private' : ''}.story.json`;
}

function download(doc: StoryProject, target: PublishTarget): void {
  const data = target === 'public' ? publicBuild(doc) : doc;
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName(doc, target);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The publish check, the credits it will generate, and the novel file for the Player. */
export function PublishChecks({
  doc,
  story,
  playtest,
}: {
  readonly doc: StoryProject;
  readonly story: CompiledStory;
  readonly playtest: PlaytestReport | null;
}) {
  const t = useT();
  const [target, setTarget] = useState<PublishTarget>('public');
  const check = useMemo(
    () => publishCheck(doc, story, target, playtest ?? undefined),
    [doc, story, target, playtest],
  );
  const credits = useMemo(() => buildCredits(doc, target), [doc, target]);

  return (
    <>
      <div className="lib-section" data-testid="publish-check">
        <h3>{t('pub.check')}</h3>
        <Segmented
          label={t('pub.target')}
          value={target}
          options={(['public', 'private'] as const).map((value) => ({
            value,
            label: t(`pub.target.${value}` as MessageKey),
          }))}
          onChange={setTarget}
        />
        <p className="hint">{t(`pub.targetHint.${target}` as MessageKey)}</p>
        {!playtest && <p className="hint">{t('pub.runPlaytest')}</p>}
        {check.items.length === 0 ? (
          <p className="pub-ok" data-testid="pub-ok">
            {t('pub.allClear')}
          </p>
        ) : (
          <ul className="problems" data-testid="pub-items">
            {check.items.map((item, i) => (
              <li key={i}>
                <span
                  className="problems__item"
                  data-severity={item.severity === 'block' ? 'error' : 'warning'}
                  data-code={item.code}
                >
                  <span className="problems__text">
                    {t(`pub.code.${item.code}` as MessageKey, item.params)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="row row--wrap">
          <button
            type="button"
            className="ie-button ie-button--primary"
            data-testid="pub-download"
            disabled={!check.ok}
            onClick={() => download(doc, target)}
          >
            <Download size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('pub.download')}
          </button>
          <span className="hint" data-testid="pub-status">
            {check.ok ? t('pub.ready') : t('pub.blocked')}
          </span>
        </div>
        <p className="hint">{t('pub.howTo')}</p>
      </div>

      <div className="lib-section" data-testid="publish-credits">
        <h3>{t('pub.credits')}</h3>
        <ul className="pt-list">
          {credits.map((c, i) => (
            <li key={i} data-kind={c.kind}>
              <span>
                {c.title}
                {c.by ? ` · ${c.by}` : ''}
              </span>
              <span className="pt-count">{upper(c.license, 'en')}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
