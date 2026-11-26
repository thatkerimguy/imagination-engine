// Static Help & Legal sections: backup/publishing cards, What's New, legal summaries.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { CardGroup } from '../ui/CardGroup.tsx';
import { Glyph } from '../ui/Glyph.tsx';
import { SectionLabel } from '../ui/Page.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { BACKUP_CARDS, WHATS_NEW } from './help-content.ts';

export function BackupSection(): ReactNode {
  return (
    <View style={styles.section}>
      <SectionLabel>Backup, EPUB 3 & publishing</SectionLabel>
      <CardGroup>
        {BACKUP_CARDS.map((c) => (
          <View key={c.title} style={styles.row}>
            <Glyph name={c.icon} size={20} color="accent" />
            <View style={styles.text}>
              <Txt variant="bodyStrong">{c.title}</Txt>
              <Txt variant="meta" color="inkSecondary">
                {c.body}
              </Txt>
            </View>
          </View>
        ))}
      </CardGroup>
    </View>
  );
}

export function WhatsNewSection(): ReactNode {
  return (
    <View style={styles.section}>
      <SectionLabel>What's new (v1.0)</SectionLabel>
      {WHATS_NEW.map((line) => (
        <Txt key={line} variant="meta" color="inkSecondary">
          {`• ${line}`}
        </Txt>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  row: { flexDirection: 'row', gap: space.sm, padding: space.md },
  text: { flex: 1, gap: 2 },
});
