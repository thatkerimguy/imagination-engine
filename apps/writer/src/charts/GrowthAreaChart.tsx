// Smooth gradient-shaded area chart of one growth metric; tap or drag to inspect a point.
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, View, type GestureResponderEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import type { GrowthPoint } from '../store/growth-store.ts';
import { AppText } from '../ui/AppText.tsx';
import { useTheme } from '../ui/theme.tsx';
import { monotonePath, type Pt } from './chart-path.ts';

export type GrowthMetric = 'chars' | 'words' | 'sentences' | 'paragraphs';

export interface GrowthAreaChartProps {
  points: readonly GrowthPoint[];
  metric: GrowthMetric;
  width: number;
  height?: number;
  color?: string;
  onInspect?(p: GrowthPoint | null): void;
}

const PAD = 12;

export function GrowthAreaChart(p: GrowthAreaChartProps): ReactNode {
  const { m3 } = useTheme();
  const { points, metric, width, onInspect } = p;
  const height = p.height ?? 120;
  const color = p.color ?? m3.primary;
  const [active, setActive] = useState<number | null>(null);
  const gid = `grad-${metric}`;

  const pts = useMemo<Pt[]>(() => {
    const values = points.map((q) => q[metric]);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || 1;
    const t0 = points[0]?.ts ?? 0;
    const tSpan = (points.at(-1)?.ts ?? 0) - t0 || 1;
    const innerW = width - PAD * 2;
    const innerH = height - PAD * 2;
    return points.map((q, i) => ({
      x: points.length === 1 ? width / 2 : PAD + (i === 0 ? 0 : ((q.ts - t0) / tSpan) * innerW),
      y:
        points.length === 1 || hi === lo
          ? height / 2
          : PAD + innerH - ((q[metric] - lo) / span) * innerH,
    }));
  }, [points, metric, width, height]);

  const inspect = (e: GestureResponderEvent): void => {
    if (points.length === 0) return;
    const x = e.nativeEvent.locationX;
    let best = 0;
    for (let i = 1; i < pts.length; i++) {
      if (Math.abs(pts[i]!.x - x) < Math.abs(pts[best]!.x - x)) best = i;
    }
    setActive(best);
    onInspect?.(points[best]!);
  };

  if (points.length < 2) {
    return (
      <View style={{ width, height }} accessibilityLabel="Not enough history yet">
        <Svg width={width} height={height}>
          <Line
            x1={PAD}
            x2={width - PAD}
            y1={height / 2}
            y2={height / 2}
            stroke={m3.outlineVariant}
            strokeWidth={2}
          />
          {pts[0] ? <Circle cx={pts[0].x} cy={pts[0].y} r={5} fill={color} /> : null}
        </Svg>
        <AppText variant="labelSmall" color="onSurfaceVariant" style={{ textAlign: 'center' }}>
          Not enough history yet
        </AppText>
      </View>
    );
  }

  const line = monotonePath(pts);
  const first = pts[0]!;
  const last = pts.at(-1)!;
  const area = `${line} L${last.x.toFixed(2)} ${height - PAD} L${first.x.toFixed(2)} ${height - PAD} Z`;
  const sel = active !== null ? pts[Math.min(active, pts.length - 1)] : undefined;
  return (
    <Pressable
      onPress={inspect}
      onPressIn={inspect}
      accessibilityRole="adjustable"
      accessibilityLabel={`${metric} growth chart`}
      style={{ width, height }}
    >
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill={`url(#${gid})`} />
        <Path d={line} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Line
          x1={PAD}
          x2={width - PAD}
          y1={height - PAD}
          y2={height - PAD}
          stroke={m3.outlineVariant}
          strokeWidth={1}
        />
        {sel ? (
          <>
            <Line
              x1={sel.x}
              x2={sel.x}
              y1={PAD}
              y2={height - PAD}
              stroke={m3.outline}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <Circle
              cx={sel.x}
              cy={sel.y}
              r={6}
              fill={color}
              stroke={m3.surfaceContainer}
              strokeWidth={2}
            />
          </>
        ) : null}
      </Svg>
    </Pressable>
  );
}
