import type { Track } from '@ie/story';
import type { MessageKey } from '../messages.ts';
import { useDoc } from '../project/store.ts';
import { useT } from '../store.ts';
import { updateTrack } from '../audio/studio-audio.ts';

/** Licences a creator can pick for their own or downloaded files (catalogue tracks bring theirs). */
export const LICENSE_CHOICES = [
  'unknown',
  'own',
  'cc0-1.0',
  'cc-by-4.0',
  'cc-by-sa-4.0',
  'cc-by-nc-4.0',
  'cc-by-nd-4.0',
  'ai',
] as const;

/** A track's licence and the track that replaces it in public builds (ADR 0022). */
export function TrackPublish({ track }: { readonly track: Track }) {
  const t = useT();
  const doc = useDoc();
  const others = (doc.audio?.tracks ?? []).filter((x) => x.id !== track.id && !x.publicFallback);
  const remote = track.source.kind === 'spotify' || track.source.kind === 'youtube';
  const code = track.license?.code ?? 'unknown';
  const known = (LICENSE_CHOICES as readonly string[]).includes(code);

  return (
    <div className="card__grid">
      {!remote && (
        <label className="labelled">
          <span className="ie-label">{t('pub.license')}</span>
          <select
            className="picker"
            value={code}
            data-testid="track-license-code"
            onChange={(e) =>
              updateTrack(track.id, (x) => {
                const { license: _old, ...rest } = x;
                const value = e.target.value;
                return value === 'unknown'
                  ? rest
                  : { ...rest, license: { ...x.license, code: value } };
              })
            }
          >
            {!known && <option value={code}>{code}</option>}
            {LICENSE_CHOICES.map((c) => (
              <option key={c} value={c}>
                {t(`pub.lic.${c}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="labelled">
        <span className="ie-label">{t('pub.fallback')}</span>
        <select
          className="picker"
          value={track.publicFallback ?? ''}
          data-testid="track-fallback"
          onChange={(e) =>
            updateTrack(track.id, (x) => {
              const { publicFallback: _old, ...rest } = x;
              return e.target.value ? { ...rest, publicFallback: e.target.value } : rest;
            })
          }
        >
          <option value="">{t(remote ? 'pub.fallbackNoneRemote' : 'pub.fallbackNone')}</option>
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title || o.id}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
