import type { Label } from '@ie/story';
import { useT } from '../store.ts';

/** A name (or any short label) in both languages, side by side. */
export function LabelFields({
  value,
  onChange,
  prefix,
  testId,
}: {
  readonly value: Label | undefined;
  readonly onChange: (label: Label) => void;
  /** Shown before the language, e.g. "Description (English)". */
  readonly prefix?: string;
  readonly testId?: string;
}) {
  const t = useT();
  return (
    <>
      {(['en', 'tr'] as const).map((locale) => {
        const language = t(locale === 'en' ? 'language.en' : 'language.tr');
        return (
          <label className="labelled" key={locale}>
            <span className="ie-label">{prefix ? `${prefix} (${language})` : language}</span>
            <input
              className="field"
              lang={locale}
              value={value?.[locale] ?? ''}
              data-testid={testId ? `${testId}-${locale}` : undefined}
              onChange={(e) => onChange({ ...value, [locale]: e.target.value })}
            />
          </label>
        );
      })}
    </>
  );
}
