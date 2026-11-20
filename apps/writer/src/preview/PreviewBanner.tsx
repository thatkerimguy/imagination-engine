// Error banner for the Live Preview: offline-load failure, rejected draft, or unreachable server.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Glyph } from '../ui/Glyph.tsx';
import { radius, space } from '../ui/tokens.ts';
import { Txt } from '../ui/Txt.tsx';
import { makeStyles } from '../ui/theme.tsx';

export interface PreviewBannerProps {
  title: string;
  body: string;
  onRetry(): void;
  /** Custom-URL mode: one tap back to the built-in reader. */
  onSwitchOffline?: () => void;
  /** Custom-URL mode: open App Settings to edit the URL. */
  onChangeUrl?: () => void;
}

const useStyles = makeStyles((t) => ({
  banner: {
    marginHorizontal: space.gutter,
    marginBottom: space.sm,
    padding: space.md,
    gap: space.sm,
    borderRadius: radius.md,
    backgroundColor: t.colors.dangerSoft,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
}));

export function PreviewBanner(p: PreviewBannerProps): ReactNode {
  const styles = useStyles();
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <View style={styles.head}>
        <Glyph name="cloud-off" color="danger" />
        <Txt variant="bodyStrong" color="danger" style={styles.title}>
          {p.title}
        </Txt>
      </View>
      <Txt variant="meta" color="ink">
        {p.body}
      </Txt>
      <View style={styles.actions}>
        <ActionButton variant="secondary" label="Retry" onPress={p.onRetry} />
        {p.onSwitchOffline ? (
          <ActionButton
            label="Switch to Built-in Offline Reader"
            onPress={p.onSwitchOffline}
            testID="preview-switch-offline"
          />
        ) : null}
        {p.onChangeUrl ? (
          <ActionButton variant="ghost" label="Change reader URL" onPress={p.onChangeUrl} />
        ) : null}
      </View>
    </View>
  );
}
