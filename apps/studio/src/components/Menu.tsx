import type { LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface MenuItem {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly icon?: LucideIcon;
  readonly danger?: boolean;
  readonly disabled?: boolean;
  readonly onSelect: () => void;
}

interface MenuButtonProps {
  readonly label: string;
  readonly items: readonly MenuItem[];
  readonly children: ReactNode;
  readonly className?: string;
  readonly testId?: string;
  /** Keep focus (and the text selection) where it is while the menu is used. */
  readonly keepFocus?: boolean;
  readonly align?: 'start' | 'end';
}

/** A button that opens a small list of actions below it. Escape or a tap outside closes it. */
export function MenuButton({
  label,
  items,
  children,
  className,
  testId,
  keepFocus = false,
  align = 'start',
}: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey, true);
    if (!keepFocus)
      list.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, keepFocus]);

  const hold = keepFocus ? { onPointerDown: (e: React.PointerEvent) => e.preventDefault() } : {};

  return (
    <div className={`menu ${className ?? ''}`} ref={root}>
      <button
        type="button"
        className="ie-button ie-button--quiet menu__button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        data-testid={testId}
        onClick={() => setOpen(!open)}
        {...hold}
      >
        {children}
      </button>
      {open && (
        <ul
          className="menu__list"
          id={id}
          role="menu"
          ref={list}
          data-align={align}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            const buttons = [...(list.current?.querySelectorAll('button') ?? [])];
            const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const next =
              buttons[
                (at + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
              ];
            next?.focus();
          }}
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="menu__item"
                  data-danger={item.danger || undefined}
                  disabled={item.disabled}
                  data-testid={testId ? `${testId}-${item.id}` : undefined}
                  {...hold}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {Icon && <Icon size={16} strokeWidth={1.5} aria-hidden="true" />}
                  <span className="menu__label">
                    {item.label}
                    {item.hint && <span className="menu__hint">{item.hint}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
