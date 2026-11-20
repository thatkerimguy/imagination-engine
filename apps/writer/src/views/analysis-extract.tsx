// Extract tab: emails, links, hashtags, phones, quotes and long sentences found in the text.
// Tap copies via navigator.clipboard where it exists; elsewhere the text is selectable.
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { Block } from '@kn/core';
import { extractInfo, type ExtractedInfo } from '../analysis/static.ts';
import { AppText } from '../ui/AppText.tsx';
import { Card, Muted, SectionTitle } from '../ui/layout.tsx';
import { space } from '../ui/m3-tokens.ts';

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
  if (shown.length === 0) return <Muted>Nothing to extract yet.</Muted>;
  return (
    <View style={{ gap: space.sm }} testID="analysis-extract">
      {shown.map((s) => (
        <View key={s.key}>
          <SectionTitle>{`${s.title} (${info[s.key].length})`}</SectionTitle>
          <Card>
            {info[s.key].map((item) => (
              <Pressable
                key={item}
                accessibilityLabel={`Copy ${item}`}
                onPress={() => void copy(item).then((ok) => setCopied(ok ? item : null))}
              >
                <AppText variant="bodyMedium" selectable>
                  {item}
                </AppText>
                {copied === item ? (
                  <AppText variant="labelSmall" color="primary">
                    Copied
                  </AppText>
                ) : null}
              </Pressable>
            ))}
          </Card>
        </View>
      ))}
    </View>
  );
}
