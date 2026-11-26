// Calm read-only peek at a note from inside a chapter, with a way to open the full note.
import type { ReactNode } from 'react';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Sheet } from '../ui/Sheet.tsx';
import { Txt } from '../ui/Txt.tsx';
import { noteExcerpt } from './story-bible.ts';
import type { StoryBibleNote } from './story-bible-source.ts';

export interface StoryBiblePeekCardProps {
  visible: boolean;
  note: StoryBibleNote | null;
  onClose(): void;
  /** Navigate with `routes.note(id)`. */
  onOpenNote(id: string): void;
}

export function StoryBiblePeekCard(p: StoryBiblePeekCardProps): ReactNode {
  const { note } = p;
  const excerpt = note ? noteExcerpt(note.blocks, 900) : '';
  return (
    <Sheet
      visible={p.visible && note !== null}
      title={note?.title ?? ''}
      subtitle={note?.folderPath}
      onClose={p.onClose}
      testID="story-bible-peek"
      footer={
        note ? (
          <ActionButton
            label="Open full note"
            icon="external-link"
            variant="secondary"
            onPress={() => p.onOpenNote(note.id)}
            testID="story-bible-open-note"
          />
        ) : null
      }
    >
      <Txt variant="serifBody" color={excerpt ? 'ink' : 'inkSecondary'}>
        {excerpt || 'This note is empty.'}
      </Txt>
    </Sheet>
  );
}
