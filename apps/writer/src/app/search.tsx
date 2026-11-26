// `/search` — the Search tab lives in the root pager (page 2); this route just focuses it.
import type { ReactNode } from 'react';
import { RootTabRoute } from '../components/RootTabRoute.tsx';

export default function SearchRoute(): ReactNode {
  return <RootTabRoute tab="search" />;
}
