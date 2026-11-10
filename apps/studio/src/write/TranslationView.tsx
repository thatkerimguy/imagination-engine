import type { LocalText, StoryProject } from '@ie/story';
import { useState } from 'react';
import { Segmented } from '../components/Segmented.tsx';
import { useProject } from '../project/store.ts';
import { allPassages, blockTexts, walkBlocks } from '../project/tree.ts';
import { useT } from '../store.ts';
import { useEditor } from './edit.ts';
import { TextField } from './TextField.tsx';

interface Line {
  readonly text: LocalText;
  readonly blockId: string;
}

function linesByPassage(doc: StoryProject): Map<string, Line[]> {
  const out = new Map<string, Line[]>();
  walkBlocks(doc, ({ block, passageId }) => {
    const list = out.get(passageId) ?? [];
    for (const text of blockTexts(block)) list.push({ text, blockId: block.id });
    out.set(passageId, list);
  });
  return out;
}

const missing = (line: Line) => !line.text.en?.trim() || !line.text.tr?.trim();

/** Every line side by side in English and Turkish, with a filter for the ones still missing. */
export function TranslationView({
  doc,
  onOpen,
}: {
  readonly doc: StoryProject;
  /** Called after a passage heading is picked, to show that passage in the manuscript. */
  readonly onOpen: () => void;
}) {
  const t = useT();
  const editor = useEditor();
  const openPassage = useProject((s) => s.openPassage);
  const lines = linesByPassage(doc);
  const total = [...lines.values()].flat();
  const todo = total.filter(missing).length;
  const missingIds = () => new Set(total.filter(missing).map((l) => l.text.id));
  const [filter, setFilter] = useState<'all' | 'missing'>('missing');
  // Lines picked when the filter was chosen stay listed while they are being translated.
  const [pinned, setPinned] = useState(missingIds);

  return (
    <div className="translate" data-testid="translation">
      <div className="translate__bar">
        <Segmented
          label={t('translate.filter')}
          value={filter}
          options={[
            { value: 'missing', label: t('translate.missing', { count: todo }) },
            { value: 'all', label: t('translate.all', { count: total.length }) },
          ]}
          onChange={(next) => {
            if (next === 'missing') setPinned(missingIds());
            setFilter(next);
          }}
        />
      </div>
      {filter === 'missing' && pinned.size === 0 && <p className="hint">{t('translate.done')}</p>}
      {allPassages(doc).map((passage) => {
        const shown = (lines.get(passage.id) ?? []).filter(
          (l) => filter === 'all' || pinned.has(l.text.id),
        );
        if (!shown.length) return null;
        return (
          <section key={passage.id} className="translate__passage">
            <h3 className="translate__heading">
              <button
                type="button"
                onClick={() => {
                  openPassage(passage.id);
                  onOpen();
                }}
              >
                {passage.name || passage.id}
              </button>
            </h3>
            {shown.map((line) => (
              <div className="translate__row" key={line.text.id} data-testid="translation-row">
                {(['en', 'tr'] as const).map((locale) => (
                  <TextField
                    key={locale}
                    value={line.text[locale] ?? ''}
                    locale={locale}
                    prose
                    label={t(locale === 'en' ? 'language.en' : 'language.tr')}
                    placeholder={t(
                      locale === 'en' ? 'translate.placeholderEn' : 'translate.placeholderTr',
                    )}
                    testId={`translation-${locale}`}
                    onChange={(v) => editor.text(line.text.id, locale, v)}
                  />
                ))}
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
