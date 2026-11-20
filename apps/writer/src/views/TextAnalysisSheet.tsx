// Text analysis sheet: Overview (stat grid), Frequency (word bars), Extract (emails, links…).
import { useMemo, useState, type ReactNode } from 'react';
import type { Block } from '@kn/core';
import { analyzeDocument } from '../analysis/realtime.ts';
import type { TypingSpeed } from '../analysis/metrics.ts';
import { Sheet } from '../ui/Sheet.tsx';
import { UnderlineTabs, type TabOption } from '../ui/UnderlineTabs.tsx';
import { AnalysisExtract } from './analysis-extract.tsx';
import { AnalysisFrequency } from './analysis-frequency.tsx';
import { AnalysisOverview } from './analysis-overview.tsx';

type Tab = 'overview' | 'frequency' | 'extract';

const TABS: readonly TabOption<Tab>[] = [
  { value: 'overview', label: 'Overview', testID: 'analysis-tab-overview' },
  { value: 'frequency', label: 'Frequency', testID: 'analysis-tab-frequency' },
  { value: 'extract', label: 'Extract', testID: 'analysis-tab-extract' },
];

export function TextAnalysisSheet(p: {
  visible: boolean;
  blocks: readonly Block[];
  onClose(): void;
  typing?: TypingSpeed;
}): ReactNode {
  const [tab, setTab] = useState<Tab>('overview');
  const metrics = useMemo(
    () => (p.visible ? analyzeDocument(p.blocks, { typing: p.typing }) : null),
    [p.visible, p.blocks, p.typing],
  );
  return (
    <Sheet
      visible={p.visible}
      title="Text analysis"
      onClose={p.onClose}
      testID="text-analysis-sheet"
      toolbar={
        <UnderlineTabs<Tab>
          options={TABS}
          value={tab}
          onChange={setTab}
          accessibilityLabel="Analysis section"
          testID="analysis-tab"
        />
      }
    >
      {tab === 'overview' && metrics ? <AnalysisOverview m={metrics} /> : null}
      {tab === 'frequency' ? <AnalysisFrequency blocks={p.blocks} /> : null}
      {tab === 'extract' ? <AnalysisExtract blocks={p.blocks} /> : null}
    </Sheet>
  );
}
