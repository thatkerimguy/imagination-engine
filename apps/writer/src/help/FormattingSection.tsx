// Formatting & Shortcuts: markup reference, shortcuts sheet, replay welcome tour.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActionButton } from '../ui/ActionButton.tsx';
import { CardGroup } from '../ui/CardGroup.tsx';
import { SectionLabel } from '../ui/Page.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { MARKUP_NOTE, MARKUP_ROWS } from './help-content.ts';

export function FormattingSection(p: { onOpenShortcuts(): void; onReplayTour(): void }): ReactNode {
  return (
    <View style={styles.section}>
      <SectionLabel>Formatting & shortcuts</SectionLabel>
      <CardGroup>
        {MARKUP_ROWS.map((r) => (
          <View key={r.syntax} style={styles.row}>
            <Txt variant="meta" style={styles.code}>
              {r.syntax}
            </Txt>
            <Txt variant="meta" color="inkSecondary">
              {r.result}
            </Txt>
          </View>
        ))}
      </CardGroup>
      <Txt variant="meta" color="inkMuted">
        {MARKUP_NOTE}
      </Txt>
      <View style={styles.actions}>
        <ActionButton
          variant="secondary"
          icon="command"
          label="Keyboard shortcuts"
          onPress={p.onOpenShortcuts}
          testID="help-open-shortcuts"
        />
        <ActionButton
          variant="secondary"
          icon="refresh-cw"
          label="Replay welcome tour"
          onPress={p.onReplayTour}
          testID="help-replay-tour"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  code: { fontFamily: 'monospace' },
  actions: { gap: space.xs },
});
