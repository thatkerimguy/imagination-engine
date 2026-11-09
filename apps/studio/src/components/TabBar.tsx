import { Ellipsis } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { runAction } from '../kernel.ts';
import { useStudio, useT } from '../store.ts';
import { MORE, TABS, VIEWS } from '../views.ts';

/** Phone navigation: three main views plus More, at the bottom where thumbs reach. */
export function TabBar() {
  const t = useT();
  const view = useStudio((s) => s.view);
  const moreOpen = useStudio((s) => s.moreOpen);
  const setMoreOpen = useStudio((s) => s.setMoreOpen);
  const inMore = MORE.includes(view);

  return (
    <>
      <nav className="tabbar" aria-label={t('nav.label')}>
        {TABS.map((id) => {
          const { icon: Icon, label } = VIEWS[id];
          return (
            <button
              key={id}
              type="button"
              className="tabbar__item"
              aria-current={view === id ? 'page' : undefined}
              data-testid={`tab-${id}`}
              onClick={() => runAction('studio.view.open', { view: id })}
            >
              <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
              <span>{t(label)}</span>
            </button>
          );
        })}
        <button
          type="button"
          className="tabbar__item"
          aria-current={inMore ? 'page' : undefined}
          aria-expanded={moreOpen}
          data-testid="tab-more"
          onClick={() => setMoreOpen(!moreOpen)}
        >
          <Ellipsis size={20} strokeWidth={1.5} aria-hidden="true" />
          <span>{t('view.more')}</span>
        </button>
      </nav>
      {moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} />}
    </>
  );
}

function MoreSheet({ onClose }: { readonly onClose: () => void }) {
  const t = useT();
  const view = useStudio((s) => s.view);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="ie-dialog sheet"
      aria-label={t('view.more')}
      data-testid="more-sheet"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <ul className="sheet__list">
        {MORE.map((id) => {
          const { icon: Icon, label } = VIEWS[id];
          return (
            <li key={id}>
              <button
                type="button"
                className="sheet__item"
                aria-current={view === id ? 'page' : undefined}
                onClick={() => runAction('studio.view.open', { view: id })}
              >
                <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                <span>{t(label)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </dialog>
  );
}
