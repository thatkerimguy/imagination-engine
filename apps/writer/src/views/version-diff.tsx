// Crisp line diff for version history: hairline rows, a +/− gutter, tinted washes for inserted
// and deleted lines, and long unchanged runs collapsed to "… 12 unchanged lines".
import { useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import { blocksToLines, diffLines, diffStats, type Hunk } from '../analysis/diff.ts';
import { space, withAlpha } from '../ui/tokens.ts';
import { makeStyles, useTheme } from '../ui/theme.tsx';
import { Txt } from '../ui/Txt.tsx';

type Row = { kind: 'equal' | 'insert' | 'delete'; text: string } | { kind: 'gap'; text: string };

const CONTEXT = 2;
const MAX_ROWS = 400;

/** Flattens hunks into rows, collapsing unchanged runs to two lines of context per change. */
export function diffRows(hunks: readonly Hunk[]): Row[] {
  const rows: Row[] = [];
  hunks.forEach((h, i) => {
    if (h.op !== 'equal') {
      for (const text of h.lines) rows.push({ kind: h.op, text });
      return;
    }
    const first = i === 0;
    const last = i === hunks.length - 1;
    const head = first ? 0 : CONTEXT;
    const tail = last ? 0 : CONTEXT;
    if (h.lines.length <= head + tail + 1) {
      for (const text of h.lines) rows.push({ kind: 'equal', text });
      return;
    }
    for (const text of h.lines.slice(0, head)) rows.push({ kind: 'equal', text });
    const hidden = h.lines.length - head - tail;
    rows.push({ kind: 'gap', text: `… ${hidden} unchanged line${hidden === 1 ? '' : 's'}` });
    for (const text of h.lines.slice(h.lines.length - tail)) rows.push({ kind: 'equal', text });
  });
  return rows;
}

/** Diff from the current draft to the checkpoint: what restoring it would add (+) and remove (−). */
export function VersionDiff({
  current,
  snapshot,
}: {
  current: readonly unknown[];
  snapshot: readonly unknown[];
}): ReactNode {
  const { colors } = useTheme();
  const s = useStyles();
  const { rows, added, removed } = useMemo(() => {
    const hunks = diffLines(blocksToLines(current), blocksToLines(snapshot));
    return { rows: diffRows(hunks), ...diffStats(hunks) };
  }, [current, snapshot]);
  if (added === 0 && removed === 0) {
    return (
      <Txt variant="meta" color="inkSecondary" testID="version-diff">
        Identical to the current draft.
      </Txt>
    );
  }
  return (
    <View testID="version-diff" style={s.wrap}>
      <Txt variant="caption" color="inkSecondary" style={s.summary}>
        Restoring adds {added} and removes {removed} line{added + removed === 1 ? '' : 's'}.
      </Txt>
      {rows.slice(0, MAX_ROWS).map((r, i) => {
        const bg =
          r.kind === 'insert'
            ? withAlpha(colors.success, 0.16)
            : r.kind === 'delete'
              ? colors.dangerSoft
              : undefined;
        const gutter = r.kind === 'insert' ? '+' : r.kind === 'delete' ? '−' : ' ';
        return (
          <View key={i} style={[s.row, bg ? { backgroundColor: bg } : null]}>
            <Txt
              variant="meta"
              color={r.kind === 'insert' ? 'success' : r.kind === 'delete' ? 'danger' : 'inkMuted'}
              style={s.gutter}
            >
              {gutter}
            </Txt>
            <Txt
              variant="meta"
              color={r.kind === 'gap' ? 'inkMuted' : 'ink'}
              style={[s.text, r.kind === 'gap' ? s.gap : null]}
            >
              {r.text || ' '}
            </Txt>
          </View>
        );
      })}
      {rows.length > MAX_ROWS ? (
        <Txt variant="caption" color="inkMuted" style={s.summary}>
          … {rows.length - MAX_ROWS} more lines
        </Txt>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  wrap: { borderTopWidth: 1, borderColor: t.colors.hairline },
  summary: { paddingVertical: space.xs },
  row: {
    flexDirection: 'row',
    gap: space.xs,
    paddingVertical: 3,
    paddingRight: space.xs,
    borderBottomWidth: 1,
    borderColor: t.colors.hairline,
  },
  gutter: { width: 16, textAlign: 'center' },
  text: { flex: 1 },
  gap: { fontStyle: 'italic' },
}));
