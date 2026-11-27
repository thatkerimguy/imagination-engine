// One hairline row of the Trash screen: kind glyph + badge, title, "Deletes in N days", and the
// one-tap Restore / Delete forever actions.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { deletesInLabel, type TrashListItem } from '../store/trash.ts';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Glyph } from '../ui/Glyph.tsx';
import { NODE_KIND_META, type NodeKindName } from '../ui/node-kind.ts';
import { Txt } from '../ui/Txt.tsx';
import { radius, space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';

/** The node kind a Trash item shows: docs keep their story kind (character, location, ...). */
export const trashNodeKind = (item: Pick<TrashListItem, 'kind' | 'docKind'>): NodeKindName =>
  item.kind === 'novel' ? 'book' : item.kind === 'doc' ? (item.docKind ?? 'note') : item.kind;

export function TrashRow(p: {
  item: TrashListItem;
  busy: boolean;
  onRestore(): void;
  onDelete(): void;
}): ReactNode {
  const { colors } = useTheme();
  const { t, locale } = useI18n();
  const { item } = p;
  const meta = NODE_KIND_META[trashNodeKind(item)];
  const soon = item.daysLeft <= 3;
  return (
    <View style={[styles.row, { borderColor: colors.hairline }]} testID={`trash-row-${item.id}`}>
      <View style={styles.head}>
        <Glyph name={meta.icon} size={18} color="inkSecondary" />
        <View style={styles.text}>
          <Txt variant="body" numberOfLines={2}>
            {item.title || t('common.untitled')}
          </Txt>
          <View style={styles.meta}>
            <View style={[styles.badge, { borderColor: colors.hairline }]}>
              <Txt variant="meta" color="inkSecondary">
                {t(meta.labelKey)}
              </Txt>
            </View>
            <Txt variant="meta" color={soon ? 'warm' : 'inkMuted'} testID={`trash-days-${item.id}`}>
              {deletesInLabel(item.daysLeft, locale)}
            </Txt>
          </View>
        </View>
      </View>
      <View style={styles.actions}>
        <ActionButton
          compact
          variant="secondary"
          icon="rotate-ccw"
          label={t('trash.restore')}
          accessibilityLabel={t('trash.restoreA11y', { title: item.title })}
          disabled={p.busy}
          onPress={p.onRestore}
          testID={`trash-restore-${item.id}`}
        />
        <ActionButton
          compact
          variant="danger"
          icon="trash-2"
          label={t('trash.deleteConfirm')}
          accessibilityLabel={t('trash.deleteA11y', { title: item.title })}
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
