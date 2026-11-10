import type { MaterialDef } from '@ie/story';
import { RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { attachStage, stage } from '../stage/studio-stage.ts';
import { useStudio, useT } from '../store.ts';

/** How long the sample title stays; it comes back by itself before it leaves. */
const TITLE_SECONDS = 20;

/**
 * The live preview on the Studio's stage (ADR 0020): a sample title for a text material, the
 * whole panel for a post material. Every edit hands the graph straight to the stage, which
 * rebuilds the program only when the generated shader changed.
 */
export function Preview({ material }: { readonly material: MaterialDef }) {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const panel = useRef<HTMLDivElement>(null);
  const sample = t('mat.sample');

  const show = useCallback(() => {
    if (material.domain === 'text')
      stage.title({
        text: { en: sample, tr: sample },
        seconds: TITLE_SECONDS,
        exit: 'fade',
        material: material.id,
      });
    else stage.postSet({ material: material.id });
  }, [material.domain, material.id, sample]);

  useEffect(() => {
    if (!panel.current) return;
    const detach = attachStage(panel.current, null, locale);
    return detach;
  }, [locale]);

  useEffect(() => {
    stage.previewMaterial(material);
  }, [material]);

  useEffect(() => {
    show();
    if (material.domain !== 'text') return;
    const timer = setInterval(show, (TITLE_SECONDS - 2) * 1000);
    return () => clearInterval(timer);
  }, [show, material.domain]);

  return (
    <div className="mat-preview">
      <div
        className="seq-stage mat-preview__stage"
        ref={panel}
        aria-label={t('mat.preview')}
        data-testid="mat-preview"
      />
      {material.domain === 'text' && (
        <button type="button" className="ie-button ie-button--quiet" onClick={show}>
          <RotateCcw size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('mat.replay')}
        </button>
      )}
    </div>
  );
}
