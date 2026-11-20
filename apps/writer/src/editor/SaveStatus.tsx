import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import type { ChapterDraft } from '../store/use-chapter-draft.ts';
import { colors } from '../ui/theme.ts';

const LABELS: Record<ChapterDraft['status'], string> = {
  saved: 'Saved',
  saving: 'Saving…',
  pending: 'Edited',
  error: 'Save failed',
};

export function SaveStatus({ status }: { status: ChapterDraft['status'] }): ReactNode {
  return (
    <Text
      testID="save-status"
      style={[styles.text, status === 'error' && styles.error]}
      accessibilityLiveRegion="polite"
    >
      {LABELS[status]}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger },
});
