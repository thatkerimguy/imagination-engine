// Offline open-source and font notices (short summaries + names / copyright lines).
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Sheet } from '../ui/Sheet.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { LICENSES, MIT_SUMMARY, OFL_NOTICE } from './help-content.ts';

export function LicensesSheet(p: { visible: boolean; onClose(): void }): ReactNode {
  return (
    <Sheet
      visible={p.visible}
      title="Open-source licenses"
      onClose={p.onClose}
      testID="licenses-sheet"
    >
      <Txt variant="meta" color="inkSecondary">
        {OFL_NOTICE}
      </Txt>
      <Txt variant="meta" color="inkSecondary">
        {MIT_SUMMARY}
      </Txt>
      <View style={styles.list}>
        {LICENSES.map((l) => (
          <View key={l.name} style={styles.item}>
            <Txt variant="bodyStrong">{l.name}</Txt>
            <Txt variant="meta" color="inkSecondary">{`${l.license} · ${l.notice}`}</Txt>
          </View>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  item: { gap: 2 },
});
