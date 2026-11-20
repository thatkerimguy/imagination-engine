import { makeStyles } from '../ui/theme.tsx';
import { space } from '../ui/tokens.ts';

export const FOCUS_BOTTOM_PAD = space.xl * 3 + 72;

export const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.canvas },
  flex: { flex: 1 },
  content: { paddingTop: space.lg, gap: space.xs, paddingBottom: space.xl * 3 },
  title: { fontSize: 26, lineHeight: 34, paddingBottom: space.xs },
  footer: { alignItems: 'center', paddingTop: space.xl },
}));
