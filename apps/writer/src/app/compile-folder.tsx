// Book compiler for a Notes folder: its notes (and sub-folders' notes), in order, as chapters.
import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { BookCompiler } from '../compile/BookCompiler.tsx';

export default function CompileFolderScreen(): ReactNode {
  const { folder } = useLocalSearchParams<{ folder: string }>();
  return <BookCompiler key={folder} source={{ kind: 'folder', folderId: folder }} />;
}
