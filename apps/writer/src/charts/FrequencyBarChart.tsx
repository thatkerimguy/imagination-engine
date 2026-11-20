// Word-frequency bars: left-aligned word, right-aligned tabular count, and a thin 8px rounded
// accent bar on a hairline track underneath.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';

export interface FrequencyBarChartProps {
  data: readonly { word: string; count: number }[];
}

const BAR_H = 8;

export function FrequencyBarChart({ data }: FrequencyBarChartProps): ReactNode {
  const { colors } = useTheme();
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <View accessibilityLabel="Word frequency chart" style={{ gap: space.sm }}>
      {data.map((d) => (
        <View key={d.word} style={{ gap: 5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
            <Txt variant="body" numberOfLines={1} style={{ flex: 1 }}>
              {d.word}
            </Txt>
            <Txt variant="meta" color="inkSecondary">
              {String(d.count)}
            </Txt>
          </View>
          <View
            style={{ height: BAR_H, borderRadius: BAR_H / 2, backgroundColor: colors.hairline }}
          >
            <View
              style={{
                width: `${Math.max(3, (d.count / max) * 100)}%`,
                height: BAR_H,
                borderRadius: BAR_H / 2,
                backgroundColor: colors.accent,
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
