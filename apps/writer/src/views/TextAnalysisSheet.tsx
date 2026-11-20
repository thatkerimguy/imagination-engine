// Text analysis bottom sheet: Overview (all metrics), Frequency (word bars), Extract (emails…).
import { useMemo, useState, type ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import type { Block } from '@kn/core';
import { analyzeDocument } from '../analysis/realtime.ts';
import type { TypingSpeed } from '../analysis/metrics.ts';
import { SegmentedButtons } from '../ui/SegmentedButtons.tsx';
import { BottomSheet } from '../ui/BottomSheet.tsx';
import { space } from '../ui/m3-tokens.ts';
import { AnalysisExtract } from './analysis-extract.tsx';
import { AnalysisFrequency } from './analysis-frequency.tsx';
import { AnalysisOverview } from './analysis-overview.tsx';

type Tab = 'overview' | 'frequency' | 'extract';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'frequency', label: 'Frequency' },
  { value: 'extract', label: 'Extract' },
] as const;

export function TextAnalysisSheet(p: {
  visible: boolean;
  blocks: readonly Block[];
  onClose(): void;
  typing?: TypingSpeed;
}): ReactNode {
  const [tab, setTab] = useState<Tab>('overview');
  const { width } = useWindowDimensions();
  const metrics = useMemo(
    () => (p.visible ? analyzeDocument(p.blocks, { typing: p.typing }) : null),
    [p.visible, p.blocks, p.typing],
  );
  return (
    <BottomSheet
      visible={p.visible}
      title="Text analysis"
      onClose={p.onClose}
      testID="text-analysis-sheet"
    >
      <SegmentedButtons<Tab>
        segments={TABS.map((t) => ({ ...t }))}
        value={tab}
        onChange={setTab}
        accessibilityLabel="Analysis section"
        testID="analysis-tab"
      />
      {tab === 'overview' && metrics ? <AnalysisOverview m={metrics} /> : null}
      {tab === 'frequency' ? (
        <AnalysisFrequency blocks={p.blocks} width={width - space.xl * 2} />
      ) : null}
      {tab === 'extract' ? <AnalysisExtract blocks={p.blocks} /> : null}
    </BottomSheet>
  );
}
