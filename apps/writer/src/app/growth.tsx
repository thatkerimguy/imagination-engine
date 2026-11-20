// Growth charts for a target (`/growth?target=chapter:<id>&novel=&season=&chapter=`): four open
// sections (characters, words, sentences, paragraphs) over a selectable timeframe.
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
import { Divider, EmptyState, Page } from '../ui/Page.tsx';
import { space, radius } from '../ui/tokens.ts';
import { Txt } from '../ui/Txt.tsx';
import { UnderlineTabs, type TabOption } from '../ui/UnderlineTabs.tsx';
import { useTheme } from '../ui/theme.tsx';

const RANGES: readonly TabOption<GrowthRange>[] = [
  { value: 'today', label: '1D', testID: 'growth-range-today' },
  { value: '7d', label: '7D', testID: 'growth-range-7d' },
  { value: '30d', label: '30D', testID: 'growth-range-30d' },
  { value: '1y', label: '1Y', testID: 'growth-range-1y' },
  { value: 'lifetime', label: 'All', testID: 'growth-range-lifetime' },
];

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

function MetricSection(p: {
  title: string;
  metric: GrowthMetric;
  points: GrowthPoint[];
  width: number;
}): ReactNode {
  const { colors } = useTheme();
  const [inspected, setInspected] = useState<GrowthPoint | null>(null);
  const last = p.points.at(-1);
  const delta = periodDelta(p.points)[p.metric];
  const tag =
    delta < 0
      ? { bg: colors.dangerSoft, fg: colors.danger }
      : delta > 0
        ? { bg: colors.accentSoft, fg: colors.accent }
        : { bg: colors.surface, fg: colors.inkSecondary };
  return (
    <View testID={`growth-card-${p.metric}`} style={{ gap: space.xs, paddingVertical: space.md }}>
      <Txt variant="overline" color="inkSecondary">
        {p.title}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
        <Txt variant="display" style={{ fontVariant: ['tabular-nums'] }}>
          {fmt(last?.[p.metric] ?? 0)}
        </Txt>
        <View
          style={{
            backgroundColor: tag.bg,
            borderRadius: radius.xs,
            paddingHorizontal: 6,
            paddingVertical: 1,
          }}
        >
          <Txt variant="caption" style={{ color: tag.fg, fontWeight: '600' }}>
            {signed(delta)}
          </Txt>
        </View>
      </View>
      <GrowthAreaChart
        points={p.points}
        metric={p.metric}
        width={p.width}
        onInspect={setInspected}
      />
      <Txt variant="caption" color="inkMuted">
        {inspected
          ? `${new Date(inspected.ts).toLocaleString()} · ${fmt(inspected[p.metric])}`
          : 'Tap the chart to inspect a point'}
      </Txt>
    </View>
  );
}

export default function GrowthScreen(): ReactNode {
  const repo = useRepository();
  const { colors } = useTheme();
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

  const empty = (title: string, body?: string): ReactNode => (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <EmptyState icon="trending-up" title={title} body={body} />
    </View>
  );
  if (!target) return empty('Nothing to chart', 'Open Growth from a chapter or novel.');
  if (all === null) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;
  if (all.length === 0)
    return empty('No growth data yet', 'Write for a few minutes and come back.');
  const chartWidth = Math.max(120, width - space.gutter * 2);
  return (
    <Page>
      <UnderlineTabs<GrowthRange>
        fill
        options={RANGES}
        value={range}
        onChange={setRange}
        accessibilityLabel="Timeframe"
        testID="growth-range"
      />
      <View>
        {METRICS.map((m, i) => (
          <View key={m.metric}>
            {i > 0 ? <Divider /> : null}
            <MetricSection {...m} points={points} width={chartWidth} />
          </View>
        ))}
      </View>
    </Page>
  );
}
