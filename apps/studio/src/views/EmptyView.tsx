import { useT } from '../store.ts';
import type { ViewInfo } from '../views.ts';

/** Placeholder for a workspace that a later roadmap phase fills in. */
export function EmptyView({ info }: { readonly info: ViewInfo }) {
  const t = useT();
  const Icon = info.icon;
  return (
    <section className="empty" data-testid={`view-${info.id}`}>
      <Icon className="empty__icon" size={32} strokeWidth={1.25} aria-hidden="true" />
      <h2 className="empty__title">{t(info.label)}</h2>
      {info.description && <p className="empty__text">{t(info.description)}</p>}
      {info.phase !== undefined && <p className="ie-label">{t('phase', { n: info.phase })}</p>}
    </section>
  );
}
