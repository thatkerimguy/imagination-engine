// Version history sheet: checkpoints newest first (auto / manual / before-restore) with word
// counts and signed deltas, a line diff vs the current draft, restore (always snapshots the
// current text first) and delete for manual checkpoints.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useRepository } from '../store/context.tsx';
import {
  blocksWordCount,
  deleteSnapshot,
  loadVersions,
  prepareRestore,
  saveManualCheckpoint,
  type Snapshot,
  type SnapshotKind,
  type VersionTarget,
} from '../store/versions.ts';
import { ActionButton } from '../ui/ActionButton.tsx';
import { useConfirm } from '../ui/ConfirmDialog.tsx';
import { Field } from '../ui/Field.tsx';
import { Glyph, type GlyphName } from '../ui/Glyph.tsx';
import { Press } from '../ui/Press.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { space } from '../ui/tokens.ts';
import { makeStyles } from '../ui/theme.tsx';
import { Txt } from '../ui/Txt.tsx';
import { VersionDiff } from './version-diff.tsx';

export interface VersionHistorySheetProps {
  visible: boolean;
  target: VersionTarget;
  currentBlocks: readonly unknown[];
  onRestore(blocks: unknown[]): void;
  onClose(): void;
}

const KIND: Record<SnapshotKind, { label: string; icon: GlyphName }> = {
  auto: { label: 'Auto-save', icon: 'clock' },
  manual: { label: 'Checkpoint', icon: 'bookmark' },
  'pre-restore': { label: 'Before restore', icon: 'rotate-ccw' },
};

const stamp = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export const signed = (n: number): string => (n === 0 ? '±0' : n > 0 ? `+${n}` : `−${-n}`);

export function VersionHistorySheet(p: VersionHistorySheetProps): ReactNode {
  const repo = useRepository();
  const confirm = useConfirm();
  const s = useStyles();
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const { visible, target } = p;

  const reload = useCallback(async () => {
    setSnaps((await loadVersions(repo, target)).snapshots);
  }, [repo, target]);
  useEffect(() => {
    if (!visible) return;
    setSelected(null);
    void reload();
  }, [visible, reload]);

  const currentWords = blocksWordCount(p.currentBlocks);
  const save = async (): Promise<void> => {
    await saveManualCheckpoint(repo, target, p.currentBlocks, label);
    setLabel('');
    await reload();
  };
  const restore = async (snap: Snapshot): Promise<void> => {
    const ok = await confirm({
      title: 'Restore this version',
      message: 'Your current text is saved as “Before restore” first, so you can undo this.',
      confirmLabel: 'Restore',
    });
    if (!ok) return;
    const blocks = await prepareRestore(repo, target, snap.id, p.currentBlocks);
    p.onRestore(blocks);
    p.onClose();
  };
  const remove = async (snap: Snapshot): Promise<void> => {
    const ok = await confirm({
      title: 'Delete checkpoint',
      message: 'This checkpoint will be removed permanently.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await deleteSnapshot(repo, target, snap.id);
    setSelected(null);
    await reload();
  };

  return (
    <Sheet
      visible={visible}
      title="Version history"
      subtitle={`${snaps.length} checkpoint${snaps.length === 1 ? '' : 's'}`}
      onClose={p.onClose}
      testID="version-sheet"
    >
      <View style={s.save}>
        <Field
          label="Checkpoint name (optional)"
          value={label}
          onChangeText={setLabel}
          placeholder="e.g. Before the rewrite"
          dense
          testID="version-label"
        />
        <ActionButton
          variant="secondary"
          icon="plus"
          label="Save checkpoint"
          onPress={() => void save()}
          testID="version-save"
        />
      </View>
      {snaps.length === 0 ? (
        <Txt variant="body" color="inkSecondary">
          No checkpoints yet. They are saved automatically as you write, or save one yourself.
        </Txt>
      ) : null}
      <View>
        {snaps.map((snap, i) => {
          const open = selected === snap.id;
          const kind = KIND[snap.kind];
          const delta = snap.wordCount - currentWords;
          return (
            <View key={snap.id}>
              <Press
                accessibilityRole="button"
                accessibilityLabel={`${snap.label ?? kind.label}, ${stamp(snap.ts)}`}
                accessibilityState={{ expanded: open }}
                onPress={() => setSelected(open ? null : snap.id)}
                testID={`version-row-${i}`}
                style={s.row}
              >
                <Glyph name={kind.icon} size={18} color={open ? 'accent' : 'inkSecondary'} />
                <View style={s.rowText}>
                  <Txt variant="body" numberOfLines={1}>
                    {snap.label ?? kind.label}
                  </Txt>
                  <Txt variant="meta" color="inkSecondary">
                    {stamp(snap.ts)}
                  </Txt>
                </View>
                <View style={s.counts}>
                  <Txt variant="meta">{snap.wordCount.toLocaleString()} w</Txt>
                  <Txt variant="caption" color={delta < 0 ? 'danger' : 'inkMuted'}>
                    {signed(delta)}
                  </Txt>
                </View>
              </Press>
              {open ? (
                <View style={s.detail}>
                  <VersionDiff current={p.currentBlocks} snapshot={snap.blocks} />
                  <View style={s.actions}>
                    <ActionButton
                      label="Restore"
                      icon="rotate-ccw"
                      onPress={() => void restore(snap)}
                      testID="version-restore"
                    />
                    {snap.kind === 'manual' ? (
                      <ActionButton
                        variant="ghost"
                        quiet
                        label="Delete"
                        icon="trash-2"
                        onPress={() => void remove(snap)}
                        testID="version-delete"
                      />
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles((t) => ({
  save: { gap: space.xs, alignItems: 'stretch' },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
    borderBottomWidth: 1,
    borderColor: t.colors.hairline,
  },
  rowText: { flex: 1, gap: 1 },
  counts: { alignItems: 'flex-end' },
  detail: { gap: space.sm, paddingVertical: space.sm },
  actions: { flexDirection: 'row', gap: space.xs },
}));
