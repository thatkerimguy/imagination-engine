// Overview tab of the Text analysis sheet: grouped metric rows + a readability consensus card.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import {
  METRICS,
  type DocumentMetrics,
  type MetricGroup,
  type MetricId,
} from '../analysis/metrics.ts';
import { readabilityConsensus } from '../analysis/text-readability.ts';
import { AppText } from '../ui/AppText.tsx';
import { Card, SectionTitle } from '../ui/layout.tsx';
import { space } from '../ui/m3-tokens.ts';

const GROUPS: readonly { id: MetricGroup; title: string }[] = [
  { id: 'counts', title: 'Counts' },
  { id: 'vocabulary', title: 'Vocabulary' },
  { id: 'readability', title: 'Readability' },
  { id: 'time', title: 'Time' },
  { id: 'speed', title: 'Typing speed' },
];

const ALL = Object.keys(METRICS) as MetricId[];

export function AnalysisOverview({ m }: { m: DocumentMetrics }): ReactNode {
  const c = readabilityConsensus(m);
  return (
    <View style={{ gap: space.sm }} testID="analysis-overview">
      <Card>
        <AppText variant="labelLarge" color="primary">
          Readability consensus
        </AppText>
        <AppText variant="headlineSmall" testID="readability-consensus">
          {m.words === 0 ? 'No text yet' : `Grade ${Math.round(c.grade)} · ${c.label}`}
        </AppText>
        <AppText variant="bodySmall" color="onSurfaceVariant">
          Average of Flesch–Kincaid, Fog, SMOG, Coleman–Liau and ARI.
          {m.smogIsEstimate ? ' SMOG is an estimate below 30 sentences.' : ''}
        </AppText>
      </Card>
      {GROUPS.map((g) => (
        <View key={g.id}>
          <SectionTitle>{g.title}</SectionTitle>
          {ALL.filter((id) => METRICS[id].group === g.id).map((id) => (
            <View
              key={id}
              style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}
            >
              <AppText variant="bodyMedium" color="onSurfaceVariant">
                {METRICS[id].label}
                {id === 'smog' && m.smogIsEstimate ? ' (est.)' : ''}
              </AppText>
              <AppText variant="bodyMedium">{METRICS[id].format(m[id])}</AppText>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
