import { itemsFromPack, makePack, parsePack, type LibraryItem } from '@ie/story';
import { Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useT } from '../store.ts';
import { useLibrary } from './storage.ts';

function download(name: string, text: string): void {
  const file = (name || 'pack').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase();
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${file}.pack.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Exports the items shown as a pack file, and imports a pack after validating all of it. */
export function LibraryPacks({
  shown,
  onStatus,
}: {
  readonly shown: readonly LibraryItem[];
  readonly onStatus: (text: string, error?: boolean) => void;
}) {
  const t = useT();
  const add = useLibrary((s) => s.add);
  const file = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');

  const importFile = async (picked: File) => {
    try {
      const pack = parsePack(await picked.text());
      const items = itemsFromPack(pack);
      await add(items);
      onStatus(t('lib.imported', { n: items.length, name: pack.name }));
    } catch (error) {
      const notJson = error instanceof Error && error.message === 'not-json';
      onStatus(t(notJson ? 'lib.notJson' : 'lib.invalid'), true);
    }
  };

  return (
    <>
      <p className="hint">{t('lib.packsHint')}</p>
      <div className="lib-save">
        <label className="labelled">
          <span className="ie-label">{t('lib.packName')}</span>
          <input
            className="field"
            maxLength={80}
            value={name}
            placeholder={t('lib.defaultPack')}
            data-testid="lib-pack-name"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="ie-button"
          disabled={shown.length === 0}
          title={t('lib.exportShown')}
          data-testid="lib-export"
          onClick={() => {
            const pack = makePack(name || t('lib.defaultPack'), shown);
            download(pack.name, JSON.stringify(pack, null, 2));
          }}
        >
          <Download size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('lib.export')}
        </button>
        <button
          type="button"
          className="ie-button"
          data-testid="lib-import"
          onClick={() => file.current?.click()}
        >
          <Upload size={16} strokeWidth={1.5} aria-hidden="true" />
          {t('lib.import')}
        </button>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          data-testid="lib-import-file"
          onChange={(event) => {
            const picked = event.target.files?.[0];
            event.target.value = '';
            if (picked) void importFile(picked);
          }}
        />
      </div>
    </>
  );
}
