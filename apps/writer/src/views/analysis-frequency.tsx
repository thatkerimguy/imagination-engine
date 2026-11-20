// Frequency tab: one compact filter row (word class left, minimum length right) over top-15 bars.
import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { Block } from '@kn/core';
import { wordFrequency } from '../analysis/static.ts';
import { FrequencyBarChart } from '../charts/FrequencyBarChart.tsx';
import { SegmentControl, type SegmentOption } from '../ui/SegmentControl.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';

type Filter = 'all' | 'content' | 'grammar';
type MinLen = 'any' | '3' | '5';

const FILTERS: readonly SegmentOption<Filter>[] = [
  { value: 'all', label: 'All', testID: 'freq-filter-all' },
  { value: 'content', label: 'Content', testID: 'freq-filter-content' },
  { value: 'grammar', label: 'Grammar', testID: 'freq-filter-grammar' },
];
const LENGTHS: readonly SegmentOption<MinLen>[] = [
  { value: 'any', label: 'All', testID: 'freq-min-1' },
  { value: '3', label: '3+', testID: 'freq-min-3' },
  { value: '5', label: '5+', testID: 'freq-min-5' },
];

export function AnalysisFrequency(p: { blocks: readonly Block[] }): ReactNode {
  const [filter, setFilter] = useState<Filter>('all');
  const [len, setLen] = useState<MinLen>('any');
  const minLength = len === 'any' ? 1 : Number(len);
  const data = useMemo(
    () => wordFrequency(p.blocks, { filter, minLength, limit: 15 }),
    [p.blocks, filter, minLength],
  );
  return (
    <View style={{ gap: space.md }} testID="analysis-frequency">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <SegmentControl<Filter>
          compact
          options={FILTERS}
          value={filter}
          onChange={setFilter}
          accessibilityLabel="Word class"
          style={{ flex: 2.3 }}
        />
        <SegmentControl<MinLen>
          compact
          options={LENGTHS}
          value={len}
          onChange={setLen}
          accessibilityLabel="Minimum word length"
          style={{ flex: 1 }}
        />
      </View>
      {data.length === 0 ? (
        <Txt variant="body" color="inkMuted">
          No words match.
        </Txt>
      ) : (
        <FrequencyBarChart data={data} />
      )}
    </View>
  );
}
