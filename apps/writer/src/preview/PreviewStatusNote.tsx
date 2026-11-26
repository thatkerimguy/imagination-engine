// Live Preview status line under the tier bar: connection dot + which reader / which draft.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Txt } from '../ui/Txt.tsx';
import { useTheme } from '../ui/theme.tsx';
import { OsReducedPill } from './OsReducedPill.tsx';

export function PreviewStatusNote(p: {
  status: 'connecting' | 'live' | 'unreachable' | 'rejected';
  offline: boolean;
  fromLiveDraft: boolean;
  reducedMotion: boolean;
}): ReactNode {
  const { colors } = useTheme();
  return (
    <View style={styles.note}>
      <View
        style={[
          styles.dot,
          { backgroundColor: p.status === 'live' ? colors.success : colors.inkMuted },
        ]}
      />
      <Txt variant="caption" color="inkMuted" testID="preview-mode-note">
        {p.status === 'live'
          ? `Live · ${p.offline ? 'Built-in offline reader' : 'Custom reader'} · ${
              p.fromLiveDraft ? 'draft' : 'saved chapter'
            }`
          : p.status === 'connecting'
            ? 'Connecting…'
            : 'Not connected'}
      </Txt>
      {p.reducedMotion ? <OsReducedPill /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
