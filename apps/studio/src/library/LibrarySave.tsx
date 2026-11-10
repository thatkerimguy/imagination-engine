import { libraryItem } from '@ie/story';
import { BookCopy } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { MessageKey } from '../messages.ts';
import { useDoc } from '../project/store.ts';
import { useStudio, useT } from '../store.ts';
import { librarySources } from './sources.ts';
import { useLibrary } from './storage.ts';

/** Saves a sequence, material, enemy, screen, the theme or an effect from the open novel. */
export function LibrarySave({ onStatus }: { readonly onStatus: (text: string) => void }) {
  const t = useT();
  const doc = useDoc();
  const locale = useStudio((s) => s.locale);
  const add = useLibrary((s) => s.add);
  const sources = useMemo(() => librarySources(doc, locale, t('lib.theme')), [doc, locale, t]);
  const [picked, setPicked] = useState('');
  const [name, setName] = useState('');
  const source = sources.find((s) => s.key === picked) ?? sources[0];

  if (!source)
    return (
      <p className="hint" data-testid="lib-nothing">
        {t('lib.nothing')}
      </p>
    );

  const kinds = [...new Set(sources.map((s) => s.kind))];
  return (
    <div className="lib-save">
      <label className="labelled">
        <span className="ie-label">{t('lib.saveWhat')}</span>
        <select
          className="picker"
          value={source.key}
          data-testid="lib-source"
          onChange={(e) => {
            setPicked(e.target.value);
            setName('');
          }}
        >
          {kinds.map((kind) => (
            <optgroup key={kind} label={t(`lib.kind.${kind}` as MessageKey)}>
              {sources
                .filter((s) => s.kind === kind)
                .map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="labelled">
        <span className="ie-label">{t('lib.saveName')}</span>
        <input
          className="field"
          maxLength={80}
          value={name}
          placeholder={source.name}
          data-testid="lib-save-name"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="ie-button ie-button--primary"
        data-testid="lib-save"
        onClick={() => {
          const item = libraryItem(source.content, name || source.name);
          void add([item]).then(() => {
            setName('');
            onStatus(t('lib.saved', { name: item.name }));
          });
        }}
      >
        <BookCopy size={16} strokeWidth={1.5} aria-hidden="true" />
        {t('lib.saveButton')}
      </button>
    </div>
  );
}
