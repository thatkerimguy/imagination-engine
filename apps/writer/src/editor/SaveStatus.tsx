import type { ReactNode } from 'react';
import type { ChapterDraft } from '../store/use-chapter-draft.ts';
import { AppText } from '../ui/AppText.tsx';

const LABELS: Record<ChapterDraft['status'], string> = {
  saved: 'Saved',
  saving: 'Saving…',
  pending: 'Edited',
  error: 'Save failed',
};

export function SaveStatus({ status }: { status: ChapterDraft['status'] }): ReactNode {
  return (
    <AppText
      variant="labelSmall"
      color={status === 'error' ? 'error' : 'onSurfaceVariant'}
      testID="save-status"
      accessibilityLiveRegion="polite"
    >
      {LABELS[status]}
    </AppText>
  );
}
