// The note editor's slim top bar: Back, `118w · Saved`, Undo, Redo and the ⋯ menu.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SaveStatus } from '../editor/SaveStatus.tsx';
import { IconBtn } from '../ui/IconBtn.tsx';
import { PopoverMenu, type MenuItem } from '../ui/PopoverMenu.tsx';
import { Press } from '../ui/Press.tsx';
import { TopBar } from '../ui/TopBar.tsx';
import { Txt } from '../ui/Txt.tsx';
import type { NoteDraft } from './use-note-draft.ts';

export interface NoteTopBarProps {
  words: number;
  draft: Pick<NoteDraft, 'status' | 'canUndo' | 'canRedo' | 'undo' | 'redo'>;
  scrolled: boolean;
  menu: readonly MenuItem[];
  onBack(): void;
  onStats(): void;
}

export function NoteTopBar({ draft, ...p }: NoteTopBarProps): ReactNode {
  return (
    <TopBar
      scrolled={p.scrolled}
      onBack={p.onBack}
      testID="editor-top-bar"
      titleSlot={
        <Press
          onPress={p.onStats}
          wash={null}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 44,
            alignSelf: 'flex-start',
          }}
          accessibilityRole="button"
          accessibilityLabel={`${p.words} words. Open text analysis`}
          testID="stats-pill"
        >
          <Txt variant="meta" color="inkMuted">{`${p.words.toLocaleString('en-US')}w · `}</Txt>
          <SaveStatus status={draft.status} />
        </Press>
      }
      actions={
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconBtn
            icon="rotate-ccw"
            accessibilityLabel="Undo"
            onPress={draft.undo}
            disabled={!draft.canUndo}
            testID="undo-button"
          />
          <IconBtn
            icon="rotate-cw"
            accessibilityLabel="Redo"
            onPress={draft.redo}
            disabled={!draft.canRedo}
            testID="redo-button"
          />
          <PopoverMenu items={p.menu} accessibilityLabel="More" testID="editor-menu" />
        </View>
      }
    />
  );
}
