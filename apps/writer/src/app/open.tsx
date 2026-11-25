// App Link landing: open the novel's outline when this device has that book, else the Library.
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { routes } from '../routes.ts';
import { useRepository } from '../store/context.tsx';
import { Page } from '../ui/Page.tsx';

export default function OpenLinkScreen(): ReactNode {
  const repo = useRepository();
  const { novel } = useLocalSearchParams<{ novel?: string }>();
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const slug = typeof novel === 'string' ? novel : '';
    (slug ? repo.getNovel(slug) : Promise.resolve(null))
      .then((found) => live && setTarget(found ? routes.outline(found.id) : routes.shelf))
      .catch(() => live && setTarget(routes.shelf));
    return () => {
      live = false;
    };
  }, [repo, novel]);
  return target ? <Redirect href={target} /> : <Page>{null}</Page>;
}
