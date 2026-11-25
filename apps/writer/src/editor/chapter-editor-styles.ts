import { makeStyles } from '../ui/theme.tsx';
import { READING_MAX } from '../ui/layout-class.ts';
import { space } from '../ui/tokens.ts';

export const FOCUS_BOTTOM_PAD = space.xl * 3 + 72;

export const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.canvas },
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  // Medium / Expanded: a centred 720 dp reading column.
  measure: { width: '100%', maxWidth: READING_MAX, alignSelf: 'center' },
  content: { paddingTop: space.lg, gap: space.xs, paddingBottom: space.xl * 3 },
  title: { fontSize: 26, lineHeight: 34, paddingBottom: space.xs },
  footer: { alignItems: 'center', paddingTop: space.xl },
}));
