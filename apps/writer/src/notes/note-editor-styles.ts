// Layout styles for the note editor (same rhythm as the chapter editor).
import { READING_MAX } from '../ui/layout-class.ts';
import { makeStyles } from '../ui/theme.tsx';
import { space } from '../ui/tokens.ts';

export const useNoteEditorStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.canvas },
  flex: { flex: 1 },
  content: { paddingTop: space.lg, gap: space.xs, paddingBottom: space.xl * 3 },
  measure: { width: '100%', maxWidth: READING_MAX, alignSelf: 'center' },
}));
