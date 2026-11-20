// Extract tab: emails, links, hashtags, phones, quotes and long sentences found in the text.
// Tap copies via navigator.clipboard where it exists; elsewhere the text is selectable.
import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { Block } from '@kn/core';
import { extractInfo, type ExtractedInfo } from '../analysis/static.ts';
import { Press } from '../ui/Press.tsx';
import { Divider, SectionLabel } from '../ui/Page.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';

const SECTIONS: readonly { key: keyof ExtractedInfo; title: string }[] = [
  { key: 'emails', title: 'Emails' },
  { key: 'urls', title: 'Links' },
  { key: 'hashtags', title: 'Hashtags' },
  { key: 'phones', title: 'Phone numbers' },
  { key: 'quotes', title: 'Quoted lines' },
  { key: 'longSentences', title: 'Long sentences (25+ words)' },
];

type ClipboardHost = { navigator?: { clipboard?: { writeText(t: string): Promise<void> } } };

async function copy(text: string): Promise<boolean> {
  const clip = (globalThis as ClipboardHost).navigator?.clipboard;
  if (!clip) return false;
  try {
    await clip.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function AnalysisExtract({ blocks }: { blocks: readonly Block[] }): ReactNode {
  const info = useMemo(() => extractInfo(blocks), [blocks]);
  const [copied, setCopied] = useState<string | null>(null);
  const shown = SECTIONS.filter((s) => info[s.key].length > 0);
  if (shown.length === 0)
    return (
      <Txt variant="body" color="inkMuted">
        Nothing to extract yet.
      </Txt>
    );
  return (
    <View testID="analysis-extract">
      {shown.map((s) => (
        <View key={s.key}>
          <SectionLabel>{`${s.title} · ${info[s.key].length}`}</SectionLabel>
          {info[s.key].map((item, i) => (
            <View key={item}>
              {i > 0 ? <Divider /> : null}
              <Press
                accessibilityLabel={`Copy ${item}`}
                onPress={() => void copy(item).then((ok) => setCopied(ok ? item : null))}
                style={{ minHeight: 44, justifyContent: 'center', paddingVertical: space.xs }}
              >
                <Txt variant="body" selectable>
                  {item}
                </Txt>
                {copied === item ? (
                  <Txt variant="caption" color="accent">
                    Copied
                  </Txt>
                ) : null}
              </Press>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
