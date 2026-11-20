// Growth charts for a target (`/growth?target=chapter:<id>&novel=&season=&chapter=`): four tonal
// cards (characters, words, sentences, paragraphs) over a selectable timeframe.
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { GrowthAreaChart, type GrowthMetric } from '../charts/GrowthAreaChart.tsx';
import { useRepository } from '../store/context.tsx';
import {
  loadGrowth,
  periodDelta,
  seriesForRange,
  type GrowthPoint,
  type GrowthRange,
  type GrowthTarget,
} from '../store/growth-store.ts';
import { AppText } from '../ui/AppText.tsx';
import { EmptyState, Screen } from '../ui/layout.tsx';
import { shape, space } from '../ui/m3-tokens.ts';
import { SegmentedButtons } from '../ui/SegmentedButtons.tsx';
import { useTheme } from '../ui/theme.tsx';

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '1y', label: '1 Year' },
  { value: 'lifetime', label: 'Lifetime' },
] as const;

const METRICS: readonly { metric: GrowthMetric; title: string }[] = [
  { metric: 'chars', title: 'Characters' },
  { metric: 'words', title: 'Words' },
  { metric: 'sentences', title: 'Sentences' },
  { metric: 'paragraphs', title: 'Paragraphs' },
];

const TARGET_RE = /^(chapter|novel|doc|folder):.+/;
const isTarget = (t: string | undefined): t is GrowthTarget => !!t && TARGET_RE.test(t);
const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
const signed = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmt(Math.abs(n))}`;

function MetricCard(p: {
  title: string;
  metric: GrowthMetric;
  points: GrowthPoint[];
  width: number;
}): ReactNode {
  const { m3 } = useTheme();
  const [inspected, setInspected] = useState<GrowthPoint | null>(null);
  const last = p.points.at(-1);
  const delta = periodDelta(p.points)[p.metric];
  const deltaColor =
    delta > 0 ? m3.primary : delta < 0 ? m3.error : m3.onSurfaceVariant;
  return (
    <View
      testID={`growth-card-${p.metric}`}
      style={{
        backgroundColor: m3.surfaceContainer,
        borderRadius: shape.large,
        padding: space.lg,
        gap: space.sm,
      }}
    >
      <AppText variant="labelLarge" color="onSurfaceVariant">
        {p.title}
      </AppText>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
        <AppText variant="headlineSmall">{fmt(last?.[p.metric] ?? 0)}</AppText>
        <AppText variant="titleSmall" style={{ color: deltaColor }}>
          {signed(delta)}
        </AppText>
      </View>
      <GrowthAreaChart
        points={p.points}
        metric={p.metric}
        width={p.width}
        onInspect={setInspected}
      />
      <AppText variant="labelMedium" color="onSurfaceVariant">
        {inspected
          ? `${new Date(inspected.ts).toLocaleString()} · ${fmt(inspected[p.metric])}`
          : 'Tap the chart to inspect a point'}
      </AppText>
    </View>
  );
}

export default function GrowthScreen(): ReactNode {
  const repo = useRepository();
  const params = useLocalSearchParams<{
    target?: string;
    novel?: string;
    season?: string;
    chapter?: string;
  }>();
  const { width } = useWindowDimensions();
  const target = isTarget(params.target) ? params.target : null;
  const [range, setRange] = useState<GrowthRange>('7d');
  const [all, setAll] = useState<GrowthPoint[] | null>(null);
  useEffect(() => {
    if (!target) return;
    let live = true;
    void loadGrowth(repo, target).then((s) => live && setAll(s.points));
    return () => {
      live = false;
    };
  }, [repo, target]);
  const points = useMemo(() => seriesForRange(all ?? [], range, Date.now()), [all, range]);

  if (!target) {
    return (
      <Screen>
        <EmptyState
          icon="show-chart"
          title="Nothing to chart"
          body="Open Growth from a chapter or novel."
        />
      </Screen>
    );
  }
  if (all === null) return <Screen>{null}</Screen>;
  if (all.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="show-chart"
          title="No growth data yet"
          body="Write for a few minutes and come back."
        />
      </Screen>
    );
  }
  const chartWidth = Math.max(120, width - space.lg * 4);
  return (
    <Screen>
      <SegmentedButtons<GrowthRange>
        segments={RANGES.map((r) => ({ ...r }))}
        value={range}
        onChange={setRange}
        accessibilityLabel="Timeframe"
        testID="growth-range"
      />
      {METRICS.map((m) => (
        <MetricCard key={m.metric} {...m} points={points} width={chartWidth} />
      ))}
    </Screen>
  );
}
