import { DEMUCS_SIZE } from '@ie/audio';
import { Download, Drum, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { findAllDrumHits, stemModel, tracksWithoutDrums, useStems } from '../audio/studio-stems.ts';
import { useProject } from '../project/store.ts';
import { useT } from '../store.ts';

const SIZE_MB = Math.round(DEMUCS_SIZE / 1e6);
/** Phones and tablets have neither the memory nor the time for a 180 MB network. */
const desktop = () => typeof matchMedia === 'undefined' || !matchMedia('(pointer: coarse)').matches;

/** Stem separation: download the model on a desktop, then find every song's drum hits. */
export function StemsSetup() {
  const t = useT();
  const model = stemModel.use();
  const tracks = useProject((s) => s.history?.present.audio?.tracks);
  const jobs = useStems((s) => s.jobs);
  const [running, setRunning] = useState(false);
  const canRun = desktop();

  useEffect(() => {
    if (stemModel.use.getState().status === 'checking') void stemModel.check();
  }, []);

  const todo = tracksWithoutDrums(tracks ?? []);
  const nameOf = (id: string) => tracks?.find((tr) => tr.id === id)?.title ?? id;
  const working = Object.entries(jobs).find(([, job]) => 'fraction' in job);
  const failed = Object.entries(jobs).filter(([, job]) => 'error' in job);

  const findAll = async () => {
    setRunning(true);
    try {
      await findAllDrumHits();
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="card" data-testid="stems">
      <h3 className="card__title">{t('stems.title')}</h3>
      <p className="hint">{t('stems.hint', { size: SIZE_MB })}</p>
      {!canRun && <p className="hint">{t('stems.desktopOnly')}</p>}
      <div className="page__actions">
        {model.status === 'checking' && <span className="hint">{t('sound.beatThisChecking')}</span>}
        {(model.status === 'absent' || model.status === 'error') && (
          <button
            type="button"
            className="ie-button"
            data-testid="stems-download"
            disabled={!canRun}
            onClick={() => void stemModel.download()}
          >
            <Download size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('sound.beatThisDownload', { size: SIZE_MB })}
          </button>
        )}
        {model.status === 'downloading' && (
          <>
            <progress
              className="ie-progress"
              max={model.total}
              value={model.received}
              aria-label={t('stems.title')}
            />
            <span className="hint" aria-live="polite">
              {t('sound.beatThisDownloading', {
                percent: Math.floor((model.received / model.total) * 100),
              })}
            </span>
            <button type="button" className="ie-button ie-button--quiet" onClick={stemModel.cancel}>
              <X size={16} strokeWidth={1.5} aria-hidden="true" />
              {t('sound.beatThisCancel')}
            </button>
          </>
        )}
        {model.status === 'ready' && (
          <>
            <span className="hint" data-testid="stems-ready">
              {t('sound.beatThisReady')}
            </span>
            <button
              type="button"
              className="ie-button ie-button--quiet"
              onClick={() => void stemModel.remove()}
            >
              <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
              {t('sound.beatThisRemove')}
            </button>
          </>
        )}
      </div>
      {model.status === 'error' && (
        <p className="hint" data-error>
          {t('sound.beatThisFailed')}
        </p>
      )}
      {model.status === 'ready' && canRun && (
        <div className="page__actions">
          <span className="hint" data-testid="stems-count">
            {todo.length > 0 ? t('stems.count', { count: todo.length }) : t('stems.done')}
          </span>
          {todo.length > 0 && (
            <button
              type="button"
              className="ie-button ie-button--primary"
              disabled={running}
              onClick={() => void findAll()}
            >
              <Drum size={16} strokeWidth={1.5} aria-hidden="true" />
              {t('stems.findAll')}
            </button>
          )}
        </div>
      )}
      {working && 'fraction' in working[1] && (
        <p className="hint" aria-live="polite">
          {t('stems.working', {
            name: nameOf(working[0]),
            percent: Math.floor(working[1].fraction * 100),
          })}
        </p>
      )}
      {failed.map(([id]) => (
        <p className="hint" data-error key={id}>
          {t('stems.failed', { name: nameOf(id) })}
        </p>
      ))}
    </section>
  );
}
