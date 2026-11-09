import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { buildCommands, filterCommands, type Command } from '../commands.ts';
import { runAction } from '../kernel.ts';
import { useStudio, useT } from '../store.ts';

/** Ctrl/⌘ K: every Studio command, searchable in either language. */
export function CommandPalette() {
  const setOpen = useStudio((s) => s.setPaletteOpen);
  const hud = useStudio((s) => s.hud);
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const commands = useMemo(() => buildCommands(t, { hud }), [t, hud]);
  const results = useMemo(() => filterCommands(commands, query), [commands, query]);
  const selected = Math.min(active, Math.max(results.length - 1, 0));

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const choose = (command: Command | undefined) => {
    if (!command) return;
    setOpen(false);
    runAction(command.action, command.params);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') setActive((selected + 1) % Math.max(results.length, 1));
    else if (event.key === 'ArrowUp')
      setActive((selected - 1 + results.length) % Math.max(results.length, 1));
    else if (event.key === 'Enter') choose(results[selected]);
    else return;
    event.preventDefault();
  };

  return (
    <dialog
      ref={ref}
      className="ie-dialog palette"
      aria-label={t('palette.open')}
      data-testid="palette"
      onClose={() => setOpen(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <label className="palette__search">
        <Search size={16} strokeWidth={1.5} aria-hidden="true" />
        <input
          autoFocus
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-results"
          aria-activedescendant={results[selected] ? `cmd-${results[selected].id}` : undefined}
          aria-label={t('palette.placeholder')}
          placeholder={t('palette.placeholder')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
      </label>
      <ul id="palette-results" className="palette__list" role="listbox">
        {results.map((command, index) => (
          <li
            key={command.id}
            id={`cmd-${command.id}`}
            role="option"
            aria-selected={index === selected}
            className="palette__item"
            onPointerMove={() => setActive(index)}
            onClick={() => choose(command)}
          >
            {command.label}
          </li>
        ))}
        {results.length === 0 && <li className="palette__empty">{t('palette.empty')}</li>}
      </ul>
    </dialog>
  );
}
