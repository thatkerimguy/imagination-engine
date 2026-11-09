import {
  collectDeviceReport,
  renderReport,
  reportToText,
  type DeviceReport,
} from '@ie/diagnostics';
import { useEffect, useRef, useState } from 'react';
import { useStudio, useT } from '../store.ts';

function collect(): Promise<DeviceReport> {
  // AudioContext can't start before the first user gesture; skip that probe until there's been one.
  const activated = navigator.userActivation?.hasBeenActive ?? true;
  return collectDeviceReport({ probeAudio: activated });
}

export function DiagnosticsView() {
  const t = useT();
  const locale = useStudio((s) => s.locale);
  const [report, setReport] = useState<DeviceReport | null>(null);
  const [copied, setCopied] = useState(false);
  const target = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    void collect().then((next) => {
      if (live) setReport(next);
    });
    return () => {
      live = false;
    };
  }, []);

  // The report renderer is shared with the framework-free Player, so it returns a DOM element.
  useEffect(() => {
    if (report && target.current) target.current.replaceChildren(renderReport(report, locale));
  }, [report, locale]);

  const copy = () => {
    if (!report) return;
    void navigator.clipboard?.writeText(reportToText(report)).then(() => setCopied(true));
  };

  const again = () => {
    setReport(null);
    setCopied(false);
    void collect().then(setReport);
  };

  return (
    <section className="page" data-testid="view-diagnostics">
      <h2 className="page__title">{t('view.diagnostics')}</h2>
      <p className="page__intro">{t('diagnostics.intro')}</p>
      {report ? (
        <>
          <div ref={target} />
          <div className="page__actions">
            <button type="button" className="ie-button" onClick={copy}>
              {copied ? t('diagnostics.copied') : t('diagnostics.copy')}
            </button>
            <button type="button" className="ie-button ie-button--quiet" onClick={again}>
              {t('diagnostics.refresh')}
            </button>
          </div>
        </>
      ) : (
        <p className="page__intro">{t('diagnostics.collecting')}</p>
      )}
    </section>
  );
}
