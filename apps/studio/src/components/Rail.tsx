import { runAction } from '../kernel.ts';
import { useStudio, useT } from '../store.ts';
import { RAIL_BOTTOM, RAIL_MAIN, VIEWS, type ViewId } from '../views.ts';

function RailItem({ id }: { readonly id: ViewId }) {
  const t = useT();
  const current = useStudio((s) => s.view === id);
  const { icon: Icon, label } = VIEWS[id];
  return (
    <button
      type="button"
      className="rail__item"
      aria-current={current ? 'page' : undefined}
      data-testid={`rail-${id}`}
      onClick={() => runAction('studio.view.open', { view: id })}
    >
      <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
      <span className="rail__label">{t(label)}</span>
    </button>
  );
}

/** Desktop and tablet navigation: one column of workspaces down the left edge. */
export function Rail() {
  const t = useT();
  return (
    <nav className="rail" aria-label={t('nav.label')}>
      <div className="rail__group">
        {RAIL_MAIN.map((id) => (
          <RailItem key={id} id={id} />
        ))}
      </div>
      <div className="rail__group">
        {RAIL_BOTTOM.map((id) => (
          <RailItem key={id} id={id} />
        ))}
      </div>
    </nav>
  );
}
