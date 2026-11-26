// Author QoL surfaces above the chapter stream: the Read-Aloud bar (mounted only while reading,
// so its speech lifecycle guards live exactly as long as the bar) and the `@mention` Story Bible
// popover + read-only peek card.
import type { Block } from '@kn/core';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { routes } from '../routes.ts';
import { IconBtn } from '../ui/IconBtn.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { ReadAloudBar } from './ReadAloudBar.tsx';
import { StoryBiblePeekCard } from './StoryBiblePeekCard.tsx';
import { StoryBiblePopover } from './StoryBiblePopover.tsx';
import type { StoryBible } from './use-story-bible.ts';

export interface EditorQolProps {
  blocks: Block[];
  reading: boolean;
  onStopReading(): void;
  onActiveBlock(index: number): void;
  bible: StoryBible;
}

export function EditorQol(p: EditorQolProps): ReactNode {
  const { bible } = p;
  const note = bible.peekNote;
  return (
    <>
      {p.reading ? (
        <View style={styles.wrap}>
          <ReadAloudBar
            blocks={p.blocks}
            onActiveBlock={p.onActiveBlock}
            onClose={p.onStopReading}
          />
        </View>
      ) : null}
      {bible.visible ? (
        <View style={styles.wrap}>
          <View style={styles.head}>
            <Txt variant="overline" color="inkSecondary" style={styles.label}>
              Story Bible{bible.query ? ` · @${bible.query}` : ''}
            </Txt>
            <IconBtn
              icon="x"
              size={18}
              accessibilityLabel="Close Story Bible"
              onPress={bible.close}
              testID="story-bible-close"
            />
          </View>
          <StoryBiblePopover
            visible
            query={bible.query}
            notes={bible.notes}
            onInsert={bible.insert}
            onPeek={bible.peek}
          />
        </View>
      ) : null}
      <StoryBiblePeekCard
        visible={note !== null}
        note={note}
        onClose={bible.closePeek}
        onOpenNote={(id) => {
          bible.closePeek();
          router.push(routes.note(id, note?.parentFolderId));
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.md, paddingTop: space.xs },
  head: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1 },
});
