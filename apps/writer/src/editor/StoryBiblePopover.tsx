// Compact list of notes matching an `@query`. Controlled: the editor owns visibility and query.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { KIND_META } from '../notes/kind-meta.ts';
import { Glyph } from '../ui/Glyph.tsx';
import { IconBtn } from '../ui/IconBtn.tsx';
import { Press } from '../ui/Press.tsx';
import { Txt } from '../ui/Txt.tsx';
import { makeStyles } from '../ui/theme.tsx';
import { radius, space } from '../ui/tokens.ts';
import { matchNotes, type MentionNote } from './story-bible.ts';

export interface StoryBiblePopoverProps {
  visible: boolean;
  query: string;
  notes: readonly MentionNote[];
  onInsert(note: MentionNote): void;
  onPeek(note: MentionNote): void;
  limit?: number;
}

export function StoryBiblePopover(p: StoryBiblePopoverProps): ReactNode {
  const s = useStyles();
  if (!p.visible) return null;
  const hits = matchNotes(p.notes, p.query, p.limit ?? 6);
  return (
    <View style={s.box} testID="story-bible-popover">
      {hits.length === 0 ? (
        <Txt variant="meta" color="inkSecondary" style={s.empty}>
          No matching notes
        </Txt>
      ) : (
        hits.map((n) => (
          <View key={n.id} style={s.row} testID={`story-bible-item-${n.id}`}>
            <Press
              accessibilityRole="button"
              accessibilityLabel={`Insert @${n.title}`}
              onPress={() => p.onInsert(n)}
              style={s.main}
              testID={`story-bible-insert-${n.id}`}
            >
              <View style={s.titleRow}>
                <Txt variant="bodyStrong" numberOfLines={1} style={s.title}>
                  {n.title}
                </Txt>
                {n.kind ? (
                  <View style={s.badge} testID={`story-bible-kind-${n.id}`}>
                    <Glyph name={KIND_META[n.kind].icon} size={11} color="inkMuted" />
                    <Txt variant="caption" color="inkMuted">
                      {KIND_META[n.kind].label}
                    </Txt>
                  </View>
                ) : null}
              </View>
              {n.folderPath ? (
                <Txt variant="caption" color="inkSecondary" numberOfLines={1}>
                  {n.folderPath}
                </Txt>
              ) : null}
            </Press>
            <IconBtn
              icon="eye"
              accessibilityLabel={`Peek at ${n.title}`}
              onPress={() => p.onPeek(n)}
              testID={`story-bible-peek-${n.id}`}
            />
          </View>
        ))
      )}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  box: {
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.hairline,
    borderRadius: radius.md,
    paddingVertical: space.xxs,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.xs },
  main: { flex: 1, minHeight: 44, justifyContent: 'center', paddingHorizontal: space.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  title: { flexShrink: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  empty: { padding: space.sm },
}));
