// A Notes sub-folder.
import { useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { NotesWorkspace } from '../../notes/NotesWorkspace.tsx';

export default function FolderScreen(): ReactNode {
  const { folderId } = useLocalSearchParams<{ folderId: string }>();
  return <NotesWorkspace folderId={folderId} />;
}
