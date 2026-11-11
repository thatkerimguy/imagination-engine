import { Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { MessageKey } from '../messages.ts';
import type { MenuBlockType } from '../project/factory.ts';
import { useT } from '../store.ts';
import { BLOCK_GROUPS, filterEntries, type BlockGroup, type PickerEntry } from './block-groups.ts';
import { BLOCK_ICON, blockHint, blockName } from './blockInfo.ts';

interface PanelProps {
  readonly onPick: (type: MenuBlockType) => void;
  readonly onClose: () => void;
  /** Item test ids are `${testId}-${type}`. */
  readonly testId?: string;
  readonly align?: 'start' | 'end';
}

/**
 * Every block an author can add, grouped, with a search box that has the focus: type a few
 * letters and press Enter. Arrow keys move, Escape or a tap outside closes.
 */
export function BlockPickerPanel({ onPick, onClose, testId, align = 'start' }: PanelProps) {
  const t = useT();
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const entries = useMemo<PickerEntry[]>(
    () =>
      (Object.entries(BLOCK_GROUPS) as [BlockGroup, readonly MenuBlockType[]][]).flatMap(
        ([group, types]) =>
          types.map((type) => ({
            type,
            group,
            label: t(blockName(type)),
            hint: t(blockHint(type)),
          })),
      ),
    [t],
  );
  const shown = filterEntries(entries, query);
  const at = Math.min(active, Math.max(0, shown.length - 1));

  // Opened near the bottom of the manuscript, the list would run past the window.
  // (Braces matter: newer browsers return a promise from scrollIntoView.)
  useEffect(() => {
    root.current?.scrollIntoView({ block: 'nearest' });
  }, []);

  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [onClose]);

  useEffect(() => {
    root.current?.querySelector(`[data-index="${at}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [at]);

  const pick = (type: MenuBlockType) => {
    onClose();
    onPick(type);
  };

  return (
    <div className="block-picker" ref={root} data-align={align} data-testid="block-picker">
      <label className="block-picker__search">
        <Search size={16} strokeWidth={1.5} aria-hidden="true" />
        <input
          className="field"
          autoFocus
          value={query}
          placeholder={t('picker.search')}
          aria-label={t('picker.search')}
          aria-controls={listId}
          aria-activedescendant={shown[at] ? `${listId}-${shown[at].type}` : undefined}
          role="combobox"
          aria-expanded="true"
          data-testid="block-picker-search"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              const step = event.key === 'ArrowDown' ? 1 : -1;
              setActive((at + step + shown.length) % Math.max(1, shown.length));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const entry = shown[at];
              if (entry) pick(entry.type);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }
          }}
        />
      </label>
      <ul className="block-picker__list" id={listId} role="listbox" aria-label={t('block.add')}>
        {shown.length === 0 && <li className="hint block-picker__empty">{t('picker.none')}</li>}
        {shown.map((entry, index) => {
          const Icon = BLOCK_ICON[entry.type];
          // A heading above the first block of each group, only while nothing is typed.
          const heading = !query.trim() && entry.group !== shown[index - 1]?.group;
          return (
            <li key={entry.type} role="presentation">
              {heading && (
                <div className="block-picker__group" role="presentation">
                  {t(`picker.group.${entry.group}` as MessageKey)}
                </div>
              )}
              <button
                type="button"
                role="option"
                id={`${listId}-${entry.type}`}
                aria-selected={index === at}
                tabIndex={-1}
                className="menu__item"
                data-index={index}
                data-testid={testId ? `${testId}-${entry.type}` : undefined}
                onPointerMove={() => setActive(index)}
                onClick={() => pick(entry.type)}
              >
                <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
                <span className="menu__label">
                  {entry.label}
                  <span className="menu__hint">{entry.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A button that opens the block picker below it. */
export function AddBlockButton({
  label,
  testId,
  onPick,
  children,
}: {
  readonly label: string;
  readonly testId?: string;
  readonly onPick: (type: MenuBlockType) => void;
  readonly children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="menu blocks__add">
      <button
        type="button"
        className="ie-button ie-button--quiet menu__button"
        aria-label={label}
        title={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid={testId}
        onPointerDown={(e) => open && e.stopPropagation()}
        onClick={() => setOpen(!open)}
      >
        {children}
      </button>
      {open && <BlockPickerPanel testId={testId} onPick={onPick} onClose={() => setOpen(false)} />}
    </div>
  );
}
