import { BEAT_THIS_SIZE } from '@ie/audio';
import { Download, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  cancelBeatThisDownload,
  checkBeatThisModel,
  downloadBeatThisModel,
  removeBeatThisModel,
  useBeatThisModel,
} from '../audio/beat-this-model.ts';
import { prepareAllTracks, tracksToPrepare, useAnalysis } from '../audio/studio-audio.ts';
import { useProject } from '../project/store.ts';
import { useT } from '../store.ts';

const SIZE_MB = Math.round(BEAT_THIS_SIZE / 1e6);

/**
 * Beat This!: download the model on this device, then bring every song's beats up to it. The
 * results are saved in the novel, so this is the desktop's job and phones benefit (ADR 0014).
 */
export function BeatThisSetup() {
  const t = useT();
  const model = useBeatThisModel();
  const tracks = useProject((s) => s.history?.present.audio?.tracks);
  const busy = useAnalysis((s) => Object.values(s.jobs).some((j) => 'stage' in j));
  const [preparing, setPreparing] = useState(false);

  useEffect(() => {
    if (useBeatThisModel.getState().status === 'checking') void checkBeatThisModel();
  }, []);

  // Recomputed with the model's status, which decides what "better" means.
  const toPrepare = model.status === 'ready' ? tracksToPrepare(tracks ?? []) : [];

  const prepare = async () => {
    setPreparing(true);
    try {
      await prepareAllTracks();
    } finally {
      setPreparing(false);
    }
  };

  return (
    <section className="card" data-testid="beat-this">
      <h3 className="card__title">{t('sound.beatThis')}</h3>
      <p className="hint">{t('sound.beatThisHint', { size: SIZE_MB })}</p>
      <div className="page__actions">
        {model.status === 'checking' && <span className="hint">{t('sound.beatThisChecking')}</span>}
        {(model.status === 'absent' || model.status === 'error') && (
          <button
            type="button"
            className="ie-button"
            data-testid="beat-this-download"
            onClick={() => void downloadBeatThisModel()}
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
              aria-label={t('sound.beatThis')}
            />
            <span className="hint" aria-live="polite">
              {t('sound.beatThisDownloading', {
                percent: Math.floor((model.received / model.total) * 100),
              })}
            </span>
            <button
              type="button"
              className="ie-button ie-button--quiet"
              onClick={cancelBeatThisDownload}
            >
              <X size={16} strokeWidth={1.5} aria-hidden="true" />
              {t('sound.beatThisCancel')}
            </button>
          </>
        )}
        {model.status === 'ready' && (
          <>
            <span className="hint" data-testid="beat-this-ready">
              {t('sound.beatThisReady')}
            </span>
            <button
              type="button"
              className="ie-button ie-button--quiet"
              onClick={() => void removeBeatThisModel()}
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
      {model.status === 'ready' && (
        <div className="page__actions">
          <span className="hint" data-testid="prepare-count">
            {toPrepare.length > 0
              ? t('sound.prepareCount', { count: toPrepare.length })
              : t('sound.prepareDone')}
          </span>
          {toPrepare.length > 0 && (
            <button
              type="button"
              className="ie-button ie-button--primary"
              disabled={preparing || busy}
              onClick={() => void prepare()}
            >
              <Sparkles size={16} strokeWidth={1.5} aria-hidden="true" />
              {t('sound.prepareAll')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
