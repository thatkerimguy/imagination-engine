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
import { audioFiles } from '../audio/studio-audio-files.ts';
import { upper } from '@ie/i18n';
import { Segmented } from '../components/Segmented.tsx';
import type { MessageKey } from '../messages.ts';
import { useT } from '../store.ts';
import { embedSongs } from './embed.ts';

function fileName(doc: StoryProject, target: PublishTarget): string {
  const name = (doc.title.en || doc.title.tr || 'novel')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .toLowerCase();
  return `${name}${target === 'private' ? '.private' : ''}.story.json`;
}

/** Saves the novel file, with its imported songs inside it; returns the songs it couldn't find. */
async function download(doc: StoryProject, target: PublishTarget): Promise<readonly string[]> {
  const built = target === 'public' ? publicBuild(doc) : doc;
  const store = await audioFiles();
  const { doc: data, missing } = await embedSongs(built, (path) => store.read(path));
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName(doc, target);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return missing;
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
  const [packing, setPacking] = useState(false);
  const [missing, setMissing] = useState<readonly string[]>([]);
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
            disabled={!check.ok || packing}
            onClick={() => {
              setPacking(true);
              download(doc, target)
                .then(setMissing)
                .catch((error: unknown) => console.warn('Download failed.', error))
                .finally(() => setPacking(false));
            }}
          >
            <Download size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('pub.download')}
          </button>
          <span className="hint" data-testid="pub-status">
            {packing ? t('pub.packing') : check.ok ? t('pub.ready') : t('pub.blocked')}
          </span>
        </div>
        {missing.length > 0 && (
          <p className="hint hint--warn" data-testid="pub-missing-songs">
            {t('pub.missingSongs', { songs: missing.join(', ') })}
          </p>
        )}
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
