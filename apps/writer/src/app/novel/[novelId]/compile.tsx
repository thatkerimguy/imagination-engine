// Book compiler for a novel: pick chapters, order them and export.
import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { BookCompiler } from '../../../compile/BookCompiler.tsx';
import { useRepoQuery } from '../../../store/context.tsx';

export default function CompileNovelScreen(): ReactNode {
  const { novelId } = useLocalSearchParams<{ novelId: string }>();
  const { data: mode } = useRepoQuery(`compile-mode:${novelId}`, (r) =>
    r.getWorkspaceMode(novelId),
  );
  if (!mode) return null;
  return <BookCompiler key={novelId} source={{ kind: 'novel', novelId }} mode={mode} />;
}
