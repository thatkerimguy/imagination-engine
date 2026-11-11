import {
  imageSetSchema,
  MEDIA_DIM_DEFAULT,
  MEDIA_FITS,
  videoSetSchema,
  type ActionBlock,
  type ImageSet,
  type VideoSet,
} from '@ie/story';
import { ImagePlus, Link, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { LabelFields } from '../../data/LabelFields.tsx';
import { mediaKind } from '../../project/media-kinds.ts';
import { useT } from '../../store.ts';
import { useWrite } from '../context.ts';
import { shrinkPicture } from './picture-file.ts';

const DIMS = [0, 0.3, 0.55, 0.75, 0.9] as const;
const HTTPS = /^https:\/\/\S+$/;

/** A web address field that only keeps https addresses (the schema refuses anything else). */
function UrlField({
  value,
  label,
  testId,
  onChange,
}: {
  readonly value: string;
  readonly label: string;
  readonly testId: string;
  readonly onChange: (url: string | undefined) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(value);
  const bad = draft.trim() !== '' && !HTTPS.test(draft.trim());
  return (
    <label className="labelled">
      <span className="ie-label">{label}</span>
      <input
        className="field"
        type="url"
        inputMode="url"
        placeholder="https://"
        value={draft}
        data-testid={testId}
        aria-invalid={bad || undefined}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          const url = next.trim();
          if (url === '') onChange(undefined);
          else if (HTTPS.test(url)) onChange(url);
        }}
      />
      {bad && <span className="hint hint--warn">{t('media.httpsOnly')}</span>}
    </label>
  );
}

/** Fit and dimming, shared by pictures and video. */
function Look({
  fit,
  dim,
  onChange,
}: {
  readonly fit: string;
  readonly dim: number;
  readonly onChange: (patch: { fit?: (typeof MEDIA_FITS)[number]; dim?: number }) => void;
}) {
  const t = useT();
  return (
    <div className="row row--wrap">
      <label className="inline-field">
        <span>{t('media.fit')}</span>
        <select
          className="picker"
          value={fit}
          onChange={(e) => onChange({ fit: e.target.value as (typeof MEDIA_FITS)[number] })}
        >
          {MEDIA_FITS.map((f) => (
            <option key={f} value={f}>
              {t(f === 'cover' ? 'media.fit.cover' : 'media.fit.contain')}
            </option>
          ))}
        </select>
      </label>
      <label className="inline-field">
        <span>{t('media.dim')}</span>
        <select
          className="picker"
          value={String(DIMS.reduce((a, b) => (Math.abs(b - dim) < Math.abs(a - dim) ? b : a)))}
          data-testid="media-dim"
          onChange={(e) => onChange({ dim: Number(e.target.value) })}
        >
          {DIMS.map((d) => (
            <option key={d} value={String(d)}>{`${Math.round(d * 100)}%`}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** Picture and video blocks (ADR 0026): what sits behind the text, chosen with forms. */
export function MediaEditor({ block }: { readonly block: ActionBlock }) {
  const t = useT();
  const { editor } = useWrite();
  const file = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  const [byUrl, setByUrl] = useState(false);
  const kind = mediaKind(block);
  const update = (params: ImageSet | VideoSet) =>
    editor.block(block.id, (b) => ({ ...(b as ActionBlock), params }), `media:${block.id}`);

  if (kind === 'video') {
    const parsed = videoSetSchema.safeParse(block.params ?? {});
    const p: VideoSet = parsed.success ? parsed.data : {};
    const set = (patch: Partial<VideoSet>) => {
      const next: Record<string, unknown> = { ...p, ...patch };
      for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
      update(next);
    };
    return (
      <div className="media-editor" data-testid="media-editor">
        <p className="hint">{p.url ? t('media.videoHint') : t('media.videoStops')}</p>
        <UrlField
          value={p.url ?? ''}
          label={t('media.videoUrl')}
          testId="media-video-url"
          onChange={(url) => set({ url })}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={p.loop ?? true}
            onChange={(e) => set({ loop: e.target.checked })}
          />
          {t('media.loop')}
        </label>
        <Look fit={p.fit ?? 'cover'} dim={p.dim ?? MEDIA_DIM_DEFAULT} onChange={set} />
      </div>
    );
  }

  const parsed = imageSetSchema.safeParse(block.params ?? {});
  const p: ImageSet = parsed.success ? parsed.data : {};
  const set = (patch: Partial<ImageSet>) => {
    const next: Record<string, unknown> = { ...p, ...patch };
    for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
    update(next);
  };
  const src = p.source?.kind === 'url' ? p.source.url : p.source?.data;
  const pick = async (picked: File | undefined) => {
    if (!picked) return;
    const data = await shrinkPicture(picked);
    setFailed(!data);
    if (data) set({ source: { kind: 'inline', data } });
  };

  return (
    <div className="media-editor" data-testid="media-editor">
      <div className="row row--wrap media-editor__source">
        {src ? (
          <img className="media-editor__thumb" src={src} alt="" data-testid="media-thumb" />
        ) : (
          <p className="hint">{t('media.pictureHides')}</p>
        )}
        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          data-testid="media-file"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <button type="button" className="ie-button" onClick={() => file.current?.click()}>
          <ImagePlus size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('media.choosePicture')}
        </button>
        <button
          type="button"
          className="ie-button ie-button--quiet"
          aria-pressed={byUrl || p.source?.kind === 'url'}
          onClick={() => setByUrl((v) => !v)}
        >
          <Link size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('media.byUrl')}
        </button>
        {src && (
          <button
            type="button"
            className="ie-button ie-button--quiet"
            data-testid="media-clear"
            onClick={() => {
              setByUrl(false);
              set({ source: undefined });
            }}
          >
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
            {t('media.clear')}
          </button>
        )}
      </div>
      {failed && <p className="hint hint--warn">{t('media.unreadable')}</p>}
      {(byUrl || p.source?.kind === 'url') && (
        <UrlField
          value={p.source?.kind === 'url' ? p.source.url : ''}
          label={t('media.pictureUrl')}
          testId="media-picture-url"
          onChange={(url) => set({ source: url ? { kind: 'url', url } : undefined })}
        />
      )}
      {src && (
        <>
          <Look fit={p.fit ?? 'cover'} dim={p.dim ?? MEDIA_DIM_DEFAULT} onChange={set} />
          <LabelFields
            value={p.alt}
            prefix={t('media.alt')}
            testId="media-alt"
            onChange={(alt) => set({ alt })}
          />
        </>
      )}
    </div>
  );
}
