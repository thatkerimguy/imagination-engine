// Chapter editor chrome: the slim 56dp top bar (Back, stats pill with save state, Undo, Redo,
// tonal Preview, ⋮ menu), the colour popover above the toolbar, and the comment sheet.
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { SaveStatus as SaveState } from '../store/autosave.ts';
import { AppText } from '../ui/AppText.tsx';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { Button } from '../ui/Button.tsx';
import { IconButton } from '../ui/IconButton.tsx';
import { shape, space } from '../ui/m3-tokens.ts';
import { OverflowMenu, type MenuItem } from '../ui/OverflowMenu.tsx';
import { TextField } from '../ui/TextField.tsx';
import { makeStyles } from '../ui/theme.tsx';
import { TopBar } from '../ui/TopBar.tsx';
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    height: 32,
    paddingHorizontal: space.md,
    borderRadius: shape.full,
    backgroundColor: t.colors.secondaryContainer,
  },
  actions: { flexDirection: 'row', alignItems: 'center' },
  popover: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: t.colors.surfaceContainerHigh,
    borderTopLeftRadius: shape.large,
    borderTopRightRadius: shape.large,
    gap: space.xs,
  },
}));

export function EditorTopBar(p: EditorTopBarProps): ReactNode {
  const s = useStyles();
  return (
    <TopBar
      title=""
      height={56}
      scrolled={p.scrolled}
      onBack={p.onBack}
      testID="editor-top-bar"
      actions={
        <View style={s.actions}>
          <Pressable
            onPress={p.onStats}
            style={s.pill}
            accessibilityRole="button"
            accessibilityLabel={`${p.words} words. Open text analysis`}
            testID="stats-pill"
          >
            <AppText variant="labelLarge" color="onSecondaryContainer">
              {`${p.words.toLocaleString('en-US')} w`}
            </AppText>
            <SaveStatus status={p.status} />
          </Pressable>
          <IconButton
            icon="undo"
            accessibilityLabel="Undo"
            onPress={p.onUndo}
            disabled={!p.canUndo}
            testID="undo-button"
          />
          <IconButton
            icon="redo"
            accessibilityLabel="Redo"
            onPress={p.onRedo}
            disabled={!p.canRedo}
            testID="redo-button"
          />
          <Button variant="tonal" label="Preview" onPress={p.onPreview} testID="preview-button" />
          <OverflowMenu items={p.menu} accessibilityLabel="More" testID="editor-menu" />
        </View>
      }
    />
  );
}

type MenuAction = 'analysis' | 'growth' | 'find' | 'outline' | 'focus' | 'layout' | 'exportJson';

const MENU: readonly (Omit<MenuItem, 'onPress'> & { action: MenuAction })[] = [
  { action: 'analysis', label: 'Text analysis', icon: 'insights', testID: 'menu-analysis' },
  { action: 'growth', label: 'Growth', icon: 'show-chart', testID: 'menu-growth' },
  { action: 'find', label: 'Find & replace', icon: 'find-replace', testID: 'menu-find' },
  { action: 'outline', label: 'Outline', icon: 'toc', testID: 'menu-outline' },
  { action: 'focus', label: 'Focus mode', icon: 'center-focus-strong', testID: 'menu-focus' },
  { action: 'layout', label: 'Appearance & layout', icon: 'palette', testID: 'menu-layout' },
  {
    action: 'exportJson',
    label: 'Export chapter JSON',
    icon: 'ios-share',
    testID: 'export-chapter',
  },
];

/** The editor's ⋮ menu items, bound to handlers. */
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
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <AppText variant="labelMedium" color="onSurfaceVariant">
          {p.channel === 'fg' ? 'Text colour' : 'Background colour'} · writer only
        </AppText>
        <IconButton icon="close" size={32} accessibilityLabel="Close colours" onPress={p.onClose} />
      </View>
      <ColorSwatchRow onPick={p.onPick} />
    </View>
  );
}

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
    <BottomSheet
      visible={p.visible}
      title="Add comment"
      subtitle="Private note — never published to readers."
      onClose={p.onClose}
      footer={<Button variant="filled" label="Add" onPress={add} disabled={!note.trim()} />}
      testID="comment-sheet"
    >
      <TextField label="Note" value={note} onChangeText={setNote} multiline autoFocus />
    </BottomSheet>
  );
}
