import type { ReactNode } from 'react';
import type { ChapterDraft } from '../store/use-chapter-draft.ts';
import { Txt } from '../ui/Txt.tsx';

const LABELS: Record<ChapterDraft['status'], string> = {
  saved: 'Saved',
  saving: 'Saving…',
  pending: 'Edited',
  error: 'Save failed',
};

/** Plain muted word; only a failed save is coloured. */
export function SaveStatus({ status }: { status: ChapterDraft['status'] }): ReactNode {
  return (
    <Txt
      variant="meta"
      color={status === 'error' ? 'danger' : 'inkMuted'}
      testID="save-status"
      accessibilityLiveRegion="polite"
    >
      {LABELS[status]}
    </Txt>
  );
}
