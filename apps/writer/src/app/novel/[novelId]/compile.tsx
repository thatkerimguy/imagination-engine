// Book compiler for a novel: pick chapters, order them and export.
import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { BookCompiler } from '../../../compile/BookCompiler.tsx';

export default function CompileNovelScreen(): ReactNode {
  const { novelId } = useLocalSearchParams<{ novelId: string }>();
  return <BookCompiler key={novelId} source={{ kind: 'novel', novelId }} />;
}
