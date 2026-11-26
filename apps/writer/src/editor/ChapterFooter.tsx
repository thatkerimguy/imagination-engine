// The quiet "Outline" link under a chapter's last block (hidden in Focus Mode).
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ActionButton } from '../ui/ActionButton.tsx';
import { useStyles } from './chapter-editor-styles.ts';

export function ChapterFooter(p: { hidden: boolean; onOutline(): void }): ReactNode {
  const s = useStyles();
  return (
    <View style={s.footer}>
      {p.hidden ? null : (
        <ActionButton variant="ghost" quiet icon="list" label="Outline" onPress={p.onOutline} />
      )}
    </View>
  );
}
