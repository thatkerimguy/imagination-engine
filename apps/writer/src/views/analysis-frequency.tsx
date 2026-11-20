// Frequency tab: Content / Grammar filters, minimum word length and a top-15 bar chart.
import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { Block } from '@kn/core';
import { wordFrequency } from '../analysis/static.ts';
import { FrequencyBarChart } from '../charts/FrequencyBarChart.tsx';
import { Chip } from '../ui/Chip.tsx';
import { Muted, Row } from '../ui/layout.tsx';
import { space } from '../ui/m3-tokens.ts';

type Filter = 'all' | 'content' | 'grammar';
const FILTERS: readonly { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'content', label: 'Content' },
  { id: 'grammar', label: 'Grammar' },
];
const MIN_LENGTHS = [1, 3, 5] as const;

export function AnalysisFrequency(p: { blocks: readonly Block[]; width: number }): ReactNode {
  const [filter, setFilter] = useState<Filter>('all');
  const [minLength, setMinLength] = useState<number>(1);
  const data = useMemo(
    () => wordFrequency(p.blocks, { filter, minLength, limit: 15 }),
    [p.blocks, filter, minLength],
  );
  return (
    <View style={{ gap: space.md }} testID="analysis-frequency">
      <Row>
        {FILTERS.map((f) => (
          <Chip
            key={f.id}
            label={f.label}
            selected={filter === f.id}
            onPress={() => setFilter(f.id)}
            testID={`freq-filter-${f.id}`}
          />
        ))}
      </Row>
      <Row>
        {MIN_LENGTHS.map((n) => (
          <Chip
            key={n}
            label={n === 1 ? 'Any length' : `${n}+ letters`}
            selected={minLength === n}
            onPress={() => setMinLength(n)}
            testID={`freq-min-${n}`}
          />
        ))}
      </Row>
      {data.length === 0 ? (
        <Muted>No words match.</Muted>
      ) : (
        <FrequencyBarChart data={data} width={p.width} />
      )}
    </View>
  );
}
