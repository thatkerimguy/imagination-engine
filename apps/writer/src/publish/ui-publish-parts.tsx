// Small presentational pieces of the publish sheet.
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Dot, ListRow } from '../ui/Page.tsx';
import { Txt } from '../ui/Txt.tsx';
import { radius, space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';
import { copyText, type CopyResult } from './copy-link.ts';

/** "Never" / "just now" / "5 min ago" / "yesterday" / a date. */
export function relativeTime(iso: string | null, now = Date.now()): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(t)) return 'Never';
  const mins = Math.floor((now - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  if (hours < 48) return 'yesterday';
  return new Date(t).toLocaleDateString();
}

export function LedgerRow(p: {
  tone: 'success' | 'warm' | 'inkMuted';
  title: string;
  count: number;
  testID: string;
  last?: boolean;
}): ReactNode {
  const { colors } = useTheme();
  return (
    <ListRow
      title={p.title}
      last={p.last}
      trailing={
        <View style={styles.count}>
          <Dot color={colors[p.tone]} />
          <Txt variant="body" testID={p.testID}>
            {String(p.count)}
          </Txt>
        </View>
      }
    />
  );
}

const FEEDBACK: Record<CopyResult, string> = {
  copied: 'Copied',
  shared: 'Share sheet opened',
  failed: 'Could not copy',
};

export function CopyRow(p: {
  title: string;
  url: string;
  testID: string;
  last?: boolean;
}): ReactNode {
  const [result, setResult] = useState<CopyResult | null>(null);
  return (
    <ListRow
      icon="link"
      title={p.title}
      detail={result ? FEEDBACK[result] : undefined}
      trailing={<View />}
      last={p.last}
      testID={p.testID}
      onPress={() => void copyText(p.url).then(setResult)}
    />
  );
}

export function Banner(p: { text: string; testID: string }): ReactNode {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.banner, { backgroundColor: colors.accentSoft }]}
      accessibilityLiveRegion="polite"
    >
      <Txt variant="body" color="accent" testID={p.testID}>
        {p.text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  count: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  banner: { borderRadius: radius.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
});
