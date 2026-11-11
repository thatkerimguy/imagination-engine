import { ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useDoc, useProject } from '../project/store.ts';
import { useT } from '../store.ts';
import { shrinkPicture } from '../write/blocks/picture-file.ts';

/**
 * An optional picture for the novel's bookshelf cover. Without one, the shelf draws a cover from
 * the title in the novel's theme. The picture is shrunk and kept inside the novel (ADR 0026).
 */
export function CoverPicker() {
  const t = useT();
  const doc = useDoc();
  const edit = useProject((s) => s.edit);
  const file = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  const src = doc.cover?.kind === 'url' ? doc.cover.url : doc.cover?.data;

  const pick = async (picked: File | undefined) => {
    if (!picked) return;
    const data = await shrinkPicture(picked);
    setFailed(!data);
    if (data) edit((d) => ({ ...d, cover: { kind: 'inline', data } }));
  };

  return (
    <section className="cover-picker" data-testid="cover-picker">
      <h3 className="ie-label">{t('project.cover')}</h3>
      <div className="cover-picker__row">
        {src ? (
          <img className="cover-picker__thumb" src={src} alt="" data-testid="cover-thumb" />
        ) : (
          <p className="hint">{t('project.coverHint')}</p>
        )}
        <div className="page__actions">
          <button type="button" className="ie-button" onClick={() => file.current?.click()}>
            <ImagePlus size={16} strokeWidth={1.5} aria-hidden="true" />
            {src ? t('project.coverChange') : t('project.coverAdd')}
          </button>
          {src && (
            <button
              type="button"
              className="ie-button ie-button--quiet"
              data-testid="cover-remove"
              onClick={() =>
                edit((d) => {
                  const { cover: _drop, ...rest } = d;
                  return rest;
                })
              }
            >
              <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
              {t('project.coverRemove')}
            </button>
          )}
        </div>
        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          data-testid="cover-file"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {failed && (
        <p className="formula__error" role="alert">
          {t('project.coverFailed')}
        </p>
      )}
    </section>
  );
}
