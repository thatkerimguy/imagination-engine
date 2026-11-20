// Overview tab: a Readability consensus band, then grouped two-column typographic stat grids
// (big tabular numbers, tiny muted captions, hairline dividers — no cards).
import type { ReactNode } from 'react';
import { View } from 'react-native';
import {
  METRICS,
  type DocumentMetrics,
  type MetricGroup,
  type MetricId,
} from '../analysis/metrics.ts';
import { readabilityConsensus } from '../analysis/text-readability.ts';
import { SectionLabel } from '../ui/Page.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { useTheme } from '../ui/theme.tsx';

const GROUPS: readonly { id: MetricGroup; title: string }[] = [
  { id: 'counts', title: 'Counts' },
  { id: 'vocabulary', title: 'Vocabulary' },
  { id: 'readability', title: 'Readability' },
  { id: 'time', title: 'Time' },
  { id: 'speed', title: 'Typing speed' },
];

const ALL = Object.keys(METRICS) as MetricId[];
const MAX_GRADE = 18;

function Band({ m }: { m: DocumentMetrics }): ReactNode {
  const { colors } = useTheme();
  const c = readabilityConsensus(m);
  const fill = Math.min(1, c.grade / MAX_GRADE);
  return (
    <View
      style={{
        gap: space.xs,
        paddingVertical: space.md,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: colors.hairline,
      }}
    >
      <Txt variant="overline" color="inkSecondary">
        Readability consensus
      </Txt>
      <Txt variant="title" testID="readability-consensus">
        {m.words === 0 ? 'No text yet' : `Grade ${Math.round(c.grade)} · ${c.label}`}
      </Txt>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.hairline }}>
        <View
          style={{
            width: `${m.words === 0 ? 0 : Math.max(3, fill * 100)}%`,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.accent,
          }}
        />
      </View>
      <Txt variant="caption" color="inkMuted">
        Average of Flesch–Kincaid, Fog, SMOG, Coleman–Liau and ARI.
        {m.smogIsEstimate ? ' SMOG is an estimate below 30 sentences.' : ''}
      </Txt>
    </View>
  );
}

function Stat({ id, m, edge }: { id: MetricId; m: DocumentMetrics; edge: boolean }): ReactNode {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexBasis: '50%',
        flexGrow: 1,
        paddingVertical: space.sm,
        paddingLeft: edge ? 0 : space.md,
        paddingRight: edge ? space.md : 0,
        borderLeftWidth: edge ? 0 : 1,
        borderColor: colors.hairline,
      }}
    >
      <Txt variant="title" style={{ fontSize: 24, lineHeight: 30, fontVariant: ['tabular-nums'] }}>
        {METRICS[id].format(m[id])}
      </Txt>
      <Txt variant="caption" color="inkMuted" numberOfLines={1}>
        {METRICS[id].label}
        {id === 'smog' && m.smogIsEstimate ? ' (est.)' : ''}
      </Txt>
    </View>
  );
}

export function AnalysisOverview({ m }: { m: DocumentMetrics }): ReactNode {
  return (
    <View style={{ gap: space.xs }} testID="analysis-overview">
      <Band m={m} />
      {GROUPS.map((g) => (
        <View key={g.id}>
          <SectionLabel>{g.title}</SectionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {ALL.filter((id) => METRICS[id].group === g.id).map((id, i) => (
              <Stat key={id} id={id} m={m} edge={i % 2 === 0} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
