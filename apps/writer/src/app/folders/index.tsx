// Notes tab root: nested folders and standalone notes.
import type { ReactNode } from 'react';
import { NotesWorkspace } from '../../notes/NotesWorkspace.tsx';

export default function NotesScreen(): ReactNode {
  return <NotesWorkspace folderId={null} />;
}
