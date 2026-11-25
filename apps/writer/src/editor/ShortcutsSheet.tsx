// Keyboard-shortcuts cheat sheet (hardware keyboards: Android tablets, ChromeOS, desktop web).
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Sheet } from '../ui/Sheet.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { formatCombo, isMacPlatform, SHORTCUTS } from './shortcuts.ts';

export interface ShortcutsSheetProps {
  visible: boolean;
  onClose(): void;
}

const isMac = (): boolean =>
  Platform.OS === 'web' && typeof navigator !== 'undefined' && isMacPlatform(navigator.platform);

export function ShortcutsSheet(p: ShortcutsSheetProps): ReactNode {
  const mac = isMac();
  return (
    <Sheet
      visible={p.visible}
      title="Keyboard shortcuts"
      onClose={p.onClose}
      testID="shortcuts-sheet"
    >
      <Txt variant="meta" color="inkMuted">
        Hardware keyboard · Meta+/ shows these on Android too
      </Txt>
      <View style={styles.list}>
        {SHORTCUTS.map((d) => (
          <View key={d.action} style={styles.row} testID={`shortcut-${d.action}`}>
            <Txt variant="body" style={styles.label}>
              {d.label}
            </Txt>
            <Txt variant="meta" color="inkSecondary" style={styles.combo}>
              {d.combos.map((c) => formatCombo(c, mac)).join('  or  ')}
            </Txt>
          </View>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.xxs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 36 },
  label: { flex: 1 },
  combo: { fontFamily: 'monospace' },
});
