// One hairline row of the Trash screen: kind glyph + badge, title, "Deletes in N days", and the
// one-tap Restore / Delete forever actions.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  deletesInLabel,
  TRASH_KIND_LABEL,
  type TrashKind,
  type TrashListItem,
} from '../store/trash.ts';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Glyph, type GlyphName } from '../ui/Glyph.tsx';
import { Txt } from '../ui/Txt.tsx';
import { radius, space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';

const ICON: Readonly<Record<TrashKind, GlyphName>> = {
  novel: 'book',
  season: 'layers',
  chapter: 'file-text',
  folder: 'folder',
  doc: 'edit-3',
};

export function TrashRow(p: {
  item: TrashListItem;
  busy: boolean;
  onRestore(): void;
  onDelete(): void;
}): ReactNode {
  const { colors } = useTheme();
  const { item } = p;
  const soon = item.daysLeft <= 3;
  return (
    <View style={[styles.row, { borderColor: colors.hairline }]} testID={`trash-row-${item.id}`}>
      <View style={styles.head}>
        <Glyph name={ICON[item.kind]} size={18} color="inkSecondary" />
        <View style={styles.text}>
          <Txt variant="body" numberOfLines={2}>
            {item.title || 'Untitled'}
          </Txt>
          <View style={styles.meta}>
            <View style={[styles.badge, { borderColor: colors.hairline }]}>
              <Txt variant="meta" color="inkSecondary">
                {TRASH_KIND_LABEL[item.kind]}
              </Txt>
            </View>
            <Txt variant="meta" color={soon ? 'warm' : 'inkMuted'} testID={`trash-days-${item.id}`}>
              {deletesInLabel(item.daysLeft)}
            </Txt>
          </View>
        </View>
      </View>
      <View style={styles.actions}>
        <ActionButton
          compact
          variant="secondary"
          icon="rotate-ccw"
          label="Restore"
          accessibilityLabel={`Restore ${item.title}`}
          disabled={p.busy}
          onPress={p.onRestore}
          testID={`trash-restore-${item.id}`}
        />
        <ActionButton
          compact
          variant="ghost"
          icon="trash-2"
          label="Delete forever"
          accessibilityLabel={`Delete ${item.title} forever`}
          disabled={p.busy}
          onPress={p.onDelete}
          testID={`trash-delete-${item.id}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: 1, paddingVertical: space.sm, gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  text: { flex: 1, gap: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  badge: { borderWidth: 1, borderRadius: radius.xs, paddingHorizontal: 6, paddingVertical: 1 },
  actions: { flexDirection: 'row', gap: space.xs, paddingLeft: 18 + space.sm, flexWrap: 'wrap' },
});
