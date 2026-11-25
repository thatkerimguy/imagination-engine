// Expanded (>= 840 dp) split-pane reference drawer beside the live Chapter Editor: the chapter
// Outline (tap jumps the editor) or the Author's Notes (read-only quick reference). It is a
// sibling of the editor column, so opening/closing it never remounts the draft or its undo history.
import type { Block } from '@kn/core';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { ChapterStyles } from '../store/chapter-styles.ts';
import { useRepoQuery } from '../store/context.tsx';
import { listAllDocs, type DocRecord } from '../store/folders.ts';
import { Glyph } from '../ui/Glyph.tsx';
import { IconBtn } from '../ui/IconBtn.tsx';
import { REFERENCE_PANE_WIDTH } from '../ui/layout-class.ts';
import { Press } from '../ui/Press.tsx';
import { SegmentControl, type SegmentOption } from '../ui/SegmentControl.tsx';
import { space, TOUCH } from '../ui/tokens.ts';
import { Txt } from '../ui/Txt.tsx';
import { makeStyles } from '../ui/theme.tsx';
import { stripInlineMarkup } from './inline-markup.ts';
import { outlineEntries } from './OutlineSheet.tsx';

type Tab = 'outline' | 'notes';
const TABS: readonly SegmentOption<Tab>[] = [
  { value: 'outline', label: 'Outline', testID: 'reference-tab-outline' },
  { value: 'notes', label: 'Notes', testID: 'reference-tab-notes' },
];

const useStyles = makeStyles((t) => ({
  pane: {
    width: REFERENCE_PANE_WIDTH,
    borderLeftWidth: 1,
    borderColor: t.colors.hairline,
    backgroundColor: t.colors.surface,
  },
}));

export function docText(doc: DocRecord): string {
  return doc.blocks
    .map((b) =>
      b.kind === 'prose'
        ? stripInlineMarkup(b.text)
        : b.kind === 'scene-break'
          ? '* * *'
          : `${b.speaker}: ${stripInlineMarkup(b.text)}`,
    )
    .filter((t) => t.trim())
    .join('\n\n');
}

export function ReferencePane(p: {
  blocks: readonly Block[];
  styles: ChapterStyles;
  onJump(blockId: string): void;
  onClose(): void;
}): ReactNode {
  const s = useStyles();
  const [tab, setTab] = useState<Tab>('outline');
  const [openDoc, setOpenDoc] = useState<string | null>(null);
  const docs = useRepoQuery('reference-notes', listAllDocs);
  const notes = [...(docs.data ?? [])].sort((a, b) => b.updatedAt - a.updatedAt);
  const entries = outlineEntries(p.blocks, p.styles);
  return (
    <View style={s.pane} testID="reference-pane" accessibilityLabel="Reference pane">
      <View style={styles.head}>
        <View style={styles.flex}>
          <SegmentControl<Tab>
            options={TABS}
            value={tab}
            onChange={setTab}
            compact
            accessibilityLabel="Reference"
            testID="reference-tabs"
          />
        </View>
        <IconBtn icon="x" accessibilityLabel="Close reference pane" onPress={p.onClose} />
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {tab === 'outline' && entries.length === 0 ? (
          <Txt color="inkSecondary">Headings, scene breaks and gimmicks will appear here.</Txt>
        ) : null}
        {tab === 'outline'
          ? entries.map((e) => (
              <Press
                key={e.id}
                accessibilityRole="button"
                accessibilityLabel={`Jump to ${e.label}`}
                onPress={() => p.onJump(e.id)}
                style={[styles.row, { paddingLeft: (e.level - 1) * space.lg }]}
                testID={`reference-outline-${e.id}`}
              >
                <Glyph name={e.icon} size={16} color="inkMuted" />
                <Txt numberOfLines={1} style={styles.flex}>
                  {e.label}
                </Txt>
              </Press>
            ))
          : null}
        {tab === 'notes' && docs.data && notes.length === 0 ? (
          <Txt color="inkSecondary">Notes from the Notes tab will appear here.</Txt>
        ) : null}
        {tab === 'notes'
          ? notes.map((d) => {
              const expanded = openDoc === d.id;
              return (
                <View key={d.id}>
                  <Press
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    accessibilityLabel={d.title}
                    onPress={() => setOpenDoc(expanded ? null : d.id)}
                    style={styles.row}
                    testID={`reference-note-${d.id}`}
                  >
                    <Glyph
                      name={expanded ? 'chevron-down' : 'chevron-right'}
                      size={16}
                      color="inkMuted"
                    />
                    <Txt variant="bodyStrong" numberOfLines={1} style={styles.flex}>
                      {d.title}
                    </Txt>
                  </Press>
                  {expanded ? (
                    <Txt color="inkSecondary" selectable style={styles.text}>
                      {docText(d) || 'Empty note.'}
                    </Txt>
                  ) : null}
                </View>
              );
            })
          : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.xs, padding: space.sm },
  flex: { flex: 1 },
  body: { paddingHorizontal: space.md, paddingBottom: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: TOUCH },
  text: { paddingLeft: space.lg, paddingBottom: space.sm },
});
