// `/folders` — the Notes tab lives in the root pager (page 1); this route just focuses it.
import type { ReactNode } from 'react';
import { RootTabRoute } from '../../components/RootTabRoute.tsx';

export default function NotesRoute(): ReactNode {
  return <RootTabRoute tab="notes" />;
}
