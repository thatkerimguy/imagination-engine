// Chapter editor chrome: the slim 52dp top bar (Back, plain `118w · Saved` text, Undo, Redo, Play,
// ⋯ menu), the colour popover above the toolbar, and the comment sheet.
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SaveStatus as SaveState } from '../store/autosave.ts';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Field } from '../ui/Field.tsx';
import { IconBtn } from '../ui/IconBtn.tsx';
import { Press } from '../ui/Press.tsx';
import { PopoverMenu, type MenuItem } from '../ui/PopoverMenu.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { TopBar } from '../ui/TopBar.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { makeStyles } from '../ui/theme.tsx';
import { ColorSwatchRow } from './FormattingToolbar.tsx';
import { SaveStatus } from './SaveStatus.tsx';

export interface EditorTopBarProps {
  words: number;
  status: SaveState;
  scrolled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  menu: readonly MenuItem[];
  onBack(): void;
  onStats(): void;
  onUndo(): void;
  onRedo(): void;
  onPreview(): void;
}

const useStyles = makeStyles((t) => ({
  popover: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    backgroundColor: t.colors.surface,
    borderTopWidth: 1,
    borderColor: t.colors.hairline,
    gap: space.xxs,
  },
}));

export function EditorTopBar(p: EditorTopBarProps): ReactNode {
  return (
    <TopBar
      scrolled={p.scrolled}
      onBack={p.onBack}
      testID="editor-top-bar"
      titleSlot={
        <Press
          onPress={p.onStats}
          wash={null}
          style={styles.stats}
          accessibilityRole="button"
          accessibilityLabel={`${p.words} words. Open text analysis`}
          testID="stats-pill"
        >
          <Txt variant="meta" color="inkMuted">
            {`${p.words.toLocaleString('en-US')}w · `}
          </Txt>
          <SaveStatus status={p.status} />
        </Press>
      }
      actions={
        <View style={styles.actions}>
          <IconBtn
            icon="rotate-ccw"
            accessibilityLabel="Undo"
            onPress={p.onUndo}
            disabled={!p.canUndo}
            testID="undo-button"
          />
          <IconBtn
            icon="rotate-cw"
            accessibilityLabel="Redo"
            onPress={p.onRedo}
            disabled={!p.canRedo}
            testID="redo-button"
          />
          <IconBtn
            icon="play"
            accessibilityLabel="Live preview"
            onPress={p.onPreview}
            testID="preview-button"
          />
          <PopoverMenu items={p.menu} accessibilityLabel="More" testID="editor-menu" />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', alignItems: 'center', minHeight: 44, alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', alignItems: 'center' },
});

type MenuAction =
  | 'analysis'
  | 'growth'
  | 'find'
  | 'outline'
  | 'versions'
  | 'focus'
  | 'layout'
  | 'publish'
  | 'exportJson';

const MENU: readonly (Omit<MenuItem, 'onPress'> & { action: MenuAction })[] = [
  { action: 'analysis', label: 'Text Analysis', icon: 'bar-chart-2', testID: 'menu-analysis' },
  { action: 'growth', label: 'Growth', icon: 'trending-up', testID: 'menu-growth' },
  { action: 'find', label: 'Find & Replace', icon: 'search', testID: 'menu-find' },
  { action: 'outline', label: 'Outline', icon: 'list', testID: 'menu-outline' },
  { action: 'versions', label: 'Version History', icon: 'clock', testID: 'menu-versions' },
  { action: 'focus', label: 'Focus Mode', icon: 'maximize', testID: 'menu-focus' },
  { action: 'layout', label: 'Appearance & Layout', icon: 'sliders', testID: 'menu-layout' },
  { action: 'publish', label: 'Publish…', icon: 'upload-cloud', testID: 'menu-publish' },
  { action: 'exportJson', label: 'Export Chapter JSON', icon: 'share', testID: 'export-chapter' },
];

/** The editor's ⋯ menu items, bound to handlers. */
export function editorMenu(on: Record<MenuAction, () => void>): MenuItem[] {
  return MENU.map(({ action, ...item }) => ({ ...item, onPress: on[action] }));
}

export function ColorPopover(p: {
  channel: 'fg' | 'bg';
  onPick(hex: string): void;
  onClose(): void;
}): ReactNode {
  const s = useStyles();
  return (
    <View style={s.popover} testID="color-popover">
      <View style={popoverHead.row}>
        <Txt variant="overline" color="inkSecondary" style={popoverHead.label}>
          {p.channel === 'fg' ? 'Text colour' : 'Background colour'} · writer only
        </Txt>
        <IconBtn icon="x" size={18} accessibilityLabel="Close colours" onPress={p.onClose} />
      </View>
      <ColorSwatchRow onPick={p.onPick} />
    </View>
  );
}

const popoverHead = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { flex: 1 },
});

export function CommentSheet(p: {
  visible: boolean;
  onAdd(note: string): void;
  onClose(): void;
}): ReactNode {
  const [note, setNote] = useState('');
  const add = (): void => {
    p.onAdd(note);
    setNote('');
  };
  return (
    <Sheet
      visible={p.visible}
      title="Add comment"
      subtitle="Private note, never published to readers."
      onClose={p.onClose}
      footer={
        <ActionButton
          label="Add"
          onPress={add}
          disabled={!note.trim()}
          style={{ marginLeft: 'auto' }}
        />
      }
      testID="comment-sheet"
    >
      <Field label="Note" value={note} onChangeText={setNote} multiline autoFocus />
    </Sheet>
  );
}
