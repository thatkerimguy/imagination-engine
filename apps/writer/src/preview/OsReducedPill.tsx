// Gate 1 observation fix: while OS Reduce Motion / "Remove animations" is on, the Preview status
// line says why the reader runs the Reduced tier whatever chip is selected.
import type { ReactNode } from 'react';
import { makeStyles } from '../ui/theme.tsx';
import { Txt } from '../ui/Txt.tsx';

const useStyles = makeStyles((t) => ({
  pill: { borderWidth: 1, borderColor: t.colors.hairline, borderRadius: 8, paddingHorizontal: 6 },
}));

export function OsReducedPill(): ReactNode {
  const s = useStyles();
  return (
    <Txt
      variant="caption"
      color="warm"
      testID="preview-os-reduced"
      accessibilityLabel="OS Reduce Motion is on, so the Reduced tier is enforced"
      style={s.pill}
    >
      Reduced (OS)
    </Txt>
  );
}
