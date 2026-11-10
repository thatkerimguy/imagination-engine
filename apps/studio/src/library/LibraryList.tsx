import { addToProject, type LibraryItem } from '@ie/story';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MessageKey } from '../messages.ts';
import { currentPassageId, useProject } from '../project/store.ts';
import { useT } from '../store.ts';
import { useLibrary } from './storage.ts';

/** One Library item: its name (editable), its kind, and adding or removing it. */
function LibraryRow({
  item,
  onStatus,
}: {
  readonly item: LibraryItem;
  readonly onStatus: (text: string, error?: boolean) => void;
}) {
  const t = useT();
  const edit = useProject((s) => s.edit);
  const rename = useLibrary((s) => s.rename);
  const remove = useLibrary((s) => s.remove);
  // Names change only here, so the field's own state is the name being typed.
  const [name, setName] = useState(item.name);
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!asking) return;
    const timer = setTimeout(() => setAsking(false), 4000);
    return () => clearTimeout(timer);
  }, [asking]);

  const addHere = () => {
    const state = useProject.getState();
    const doc = state.history?.present;
    if (!doc) return;
    const passage = currentPassageId(doc, state.passageId);
    const next = addToProject(doc, item, { passage });
    if (next === 'full') return onStatus(t('lib.full'), true);
    if (next === 'no-passage') return onStatus(t('lib.noPassage'), true);
    edit(() => next);
    onStatus(t(item.kind === 'effect' ? 'lib.addedEffect' : 'lib.added', { name: item.name }));
  };

  return (
    <li className="lib-item" data-testid="lib-item" data-kind={item.kind}>
      <input
        className="field lib-item__name"
        value={name}
        maxLength={80}
        aria-label={t('lib.rename')}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim()) void rename(item.id, name);
          else setName(item.name);
        }}
      />
      <span className="lib-item__kind">{t(`lib.kind.${item.kind}` as MessageKey)}</span>
      <button type="button" className="ie-button" data-testid="lib-add" onClick={addHere}>
        <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
        {t('lib.add')}
      </button>
      <button
        type="button"
        className="ie-button ie-button--quiet"
        data-danger
        data-testid="lib-remove"
        onClick={() => {
          if (!asking) return setAsking(true);
          void remove(item.id);
        }}
      >
        <Trash2 size={16} strokeWidth={1.5} aria-hidden="true" />
        {t('lib.remove')}
      </button>
      {asking && (
        <p className="lib-status" role="alert">
          {t('lib.removeConfirm', { name: item.name })}
        </p>
      )}
    </li>
  );
}

export function LibraryList({
  items,
  emptyText,
  onStatus,
}: {
  readonly items: readonly LibraryItem[];
  readonly emptyText: string;
  readonly onStatus: (text: string, error?: boolean) => void;
}) {
  if (items.length === 0)
    return (
      <p className="hint" data-testid="lib-empty">
        {emptyText}
      </p>
    );
  return (
    <ul className="lib-list" data-testid="lib-list">
      {items.map((item) => (
        <LibraryRow key={item.id} item={item} onStatus={onStatus} />
      ))}
    </ul>
  );
}
