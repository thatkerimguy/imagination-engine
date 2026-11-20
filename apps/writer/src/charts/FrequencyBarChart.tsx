// Horizontal word-frequency bars: label left, count right, primary bar on a surfaceContainer track.
import type { ReactNode } from 'react';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../ui/theme.tsx';

export interface FrequencyBarChartProps {
  data: readonly { word: string; count: number }[];
  width: number;
  barHeight?: number;
}

const LABEL_W = 96;
const COUNT_W = 36;
const GAP = 8;

export function FrequencyBarChart({
  data,
  width,
  barHeight = 20,
}: FrequencyBarChartProps): ReactNode {
  const { colors } = useTheme();
  const rowH = barHeight + 8;
  const trackX = LABEL_W + GAP;
  const trackW = Math.max(0, width - trackX - COUNT_W - GAP);
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <Svg
      width={width}
      height={Math.max(1, data.length * rowH)}
      accessibilityLabel="Word frequency chart"
    >
      {data.map((d, i) => (
        <G key={d.word} y={i * rowH}>
          <SvgText x={0} y={barHeight * 0.72} fontSize={13} fill={colors.onSurface}>
            {d.word.length > 13 ? `${d.word.slice(0, 12)}…` : d.word}
          </SvgText>
          <Rect
            x={trackX}
            y={0}
            width={trackW}
            height={barHeight}
            rx={barHeight / 2}
            fill={colors.surfaceContainerHighest}
          />
          <Rect
            x={trackX}
            y={0}
            width={Math.max(barHeight / 2, (d.count / max) * trackW)}
            height={barHeight}
            rx={barHeight / 2}
            fill={colors.primary}
          />
          <SvgText
            x={width}
            y={barHeight * 0.72}
            fontSize={13}
            fill={colors.onSurfaceVariant}
            textAnchor="end"
          >
            {String(d.count)}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}
