// The Welcome tour's quick actions, shared by the Library first-run launcher and Help's
// "Replay welcome tour": open the demo's Live Preview (Chrome Tide · Snake Eyes), start a new
// novel, import a manuscript (.docx / .md / .txt into Notes) or go to Backup & Restore.
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { pickAndImport } from '../import/pick-import.ts';
import { routes } from '../routes.ts';
import { useRepository } from '../store/context.tsx';
import { DEMO_NOVEL_ID, demoBundle } from '../store/demo.ts';

export interface TourActions {
  onOpenPreview(): void;
  onNewNovel(): void;
  onImport(): void;
  onRestore(): void;
}

/** `close` runs first (the sheet leaves), then the action. */
export function useTourActions(close: () => void): TourActions {
  const repo = useRepository();
  const then = (go: () => void) => (): void => {
    close();
    go();
  };
  return {
    onOpenPreview: then(() => {
      const { seasons } = demoBundle();
      const season = seasons[0]?.season;
      const chapter = season?.chapters[0];
      if (season && chapter) router.push(routes.preview(DEMO_NOVEL_ID, season.id, chapter));
    }),
    onNewNovel: then(() => router.push(routes.newNovel)),
    onImport: then(() => {
      pickAndImport(repo, { folderId: null })
        .then((id) => id && router.push(routes.note(id)))
        .catch((err: unknown) =>
          Alert.alert('Import failed', err instanceof Error ? err.message : 'Please try again.'),
        );
    }),
    onRestore: then(() => router.push(routes.appSettings)),
  };
}
