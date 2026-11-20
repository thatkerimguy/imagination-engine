// Standalone note editor: the chapter editor's prose / dialogue / scene-break experience (toolbar,
// metrics, find & replace, outline, analysis, undo/redo) over a note — no gimmicks, no preview.
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { BlockView } from '../editor/BlockView.tsx';
import { useNoteEditorStyles } from './note-editor-styles.ts';
import { FindReplaceBar } from '../editor/FindReplaceBar.tsx';
import { FormattingToolbar } from '../editor/FormattingToolbar.tsx';
import { MetricsRibbon, MetricPickerSheet } from '../editor/MetricsRibbon.tsx';
import { OutlineSheet } from '../editor/OutlineSheet.tsx';
import { useEditorActions } from '../editor/use-editor-actions.ts';
import { useFormatActions } from '../editor/use-format-actions.ts';
import { useLiveMetrics } from '../editor/use-live-metrics.ts';
import { ColorPopover, CommentSheet } from '../editor/EditorChrome.tsx';
import { ItemMetaSheet } from '../components/ItemMetaSheet.tsx';
import { Field } from '../ui/Field.tsx';
import { EmptyState } from '../ui/Page.tsx';
import type { MenuItem } from '../ui/PopoverMenu.tsx';
import { space } from '../ui/tokens.ts';
import { useWriterPrefs } from '../ui/theme.tsx';
import { useEditorTypography } from '../ui/typography.ts';
import { TextAnalysisSheet } from '../views/TextAnalysisSheet.tsx';
import { NoteTopBar } from './NoteTopBar.tsx';
import { usePromote } from './promote.ts';
import { PromoteSheet } from './PromoteSheet.tsx';
import type { NoteDraft } from './use-note-draft.ts';

export interface NoteEditorProps {
  docId: string;
  draft: NoteDraft;
  onBack(): void;
  onGrowth(): void;
  /** Appended to the ⋯ menu (e.g. "Version history"). */
  extraMenu?: MenuItem[];
}

type Sheet = 'analysis' | 'outline' | 'metrics' | 'meta' | 'promote' | null;

export function NoteEditor(p: NoteEditorProps): ReactNode {
  const { draft } = p;
  const s = useNoteEditorStyles();
  const typo = useEditorTypography();
  const [prefs] = useWriterPrefs();
  const promote = usePromote();
  const a = useEditorActions(draft.update);
  const chapter = draft.chapter;
  const blocks = draft.blocks ?? [];
  const f = useFormatActions({
    blocks,
    styles: draft.styles,
    selectedId: a.selectedId,
    defaultAlign: typo.defaultAlign,
    update: draft.update,
    updateStyles: draft.updateStyles,
    pick: a.pick,
  });
  const [sheet, setSheet] = useState<Sheet>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const offsets = useRef(new Map<string, number>());
  const metrics = useLiveMetrics(blocks);

  const jump = (id: string): void => {
    a.select(id);
    const y = offsets.current.get(id);
    if (y !== undefined)
      scroller.current?.scrollTo({ y: Math.max(0, y - space.xl), animated: true });
  };
  const menu: MenuItem[] = [
    {
      label: 'Text Analysis',
      icon: 'bar-chart-2',
      onPress: () => setSheet('analysis'),
      testID: 'menu-analysis',
    },
    { label: 'Growth', icon: 'trending-up', onPress: p.onGrowth, testID: 'menu-growth' },
    {
      label: 'Find & Replace',
      icon: 'search',
      onPress: () => setFindOpen(true),
      testID: 'menu-find',
    },
    { label: 'Outline', icon: 'list', onPress: () => setSheet('outline'), testID: 'menu-outline' },
    { label: 'Tags & Color', icon: 'tag', onPress: () => setSheet('meta'), testID: 'menu-meta' },
    {
      label: 'Promote to Chapter',
      icon: 'arrow-up-right',
      onPress: () => setSheet('promote'),
      testID: 'menu-promote',
    },
    ...(p.extraMenu ?? []),
  ];
  const shownTitle = draft.title || draft.autoTitle;

  return (
    <View style={s.screen} testID="note-editor">
      <NoteTopBar
        words={metrics.words}
        draft={draft}
        scrolled={scrolled}
        menu={menu}
        onBack={p.onBack}
        onStats={() => setSheet('analysis')}
      />
      {prefs.showMetricsRibbon ? (
        <MetricsRibbon
          metrics={metrics}
          visible={prefs.visibleMetrics}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((c) => !c)}
          onOpenAnalysis={() => setSheet('analysis')}
          onCustomize={() => setSheet('metrics')}
        />
      ) : null}
      {findOpen && chapter ? (
        <FindReplaceBar
          chapter={chapter}
          onApply={(next) => draft.update(() => next)}
          onJump={jump}
          onClose={() => setFindOpen(false)}
        />
      ) : null}
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroller}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.content, { paddingHorizontal: typo.margin }]}
          scrollEventThrottle={32}
          onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 4)}
          testID="note-stream"
        >
          <Field
            serif
            value={draft.title}
            onChangeText={draft.setTitle}
            placeholder={draft.autoTitle}
            accessibilityLabel={`Title: ${shownTitle}`}
            returnKeyType="done"
            testID="note-title"
          />
          {blocks.length === 0 ? (
            <EmptyState
              icon="edit-3"
              title="A blank page"
              body="Use the toolbar below to add prose, dialogue or a scene break."
            />
          ) : null}
          {blocks.map((block) => (
            <View
              key={block.id}
              onLayout={(e) => offsets.current.set(block.id, e.nativeEvent.layout.y)}
            >
              <BlockView
                block={block}
                selected={a.selectedId === block.id}
                autoFocus={a.focusId === block.id}
                moduleEnabled
                blockStyle={draft.styles[block.id]}
                samsungSafeIme={prefs.samsungSafeIme}
                selection={f.forcedSelection(block.id)}
                onSelectionChange={f.onSelectionChange}
                onSelect={a.select}
                onChange={a.change}
                onOpenGimmick={() => undefined}
                onToggleBeat={a.toggleBeat}
                onMove={a.move}
                onDelete={(id) => void a.remove(id)}
              />
            </View>
          ))}
        </ScrollView>
        {f.colorFor ? (
          <ColorPopover channel={f.colorFor} onPick={f.pickColor} onClose={f.closeColor} />
        ) : null}
        <FormattingToolbar
          order={prefs.toolbarOrder}
          hidden={[...prefs.hiddenTools, 'addGimmick']}
          active={f.active}
          align={f.align}
          disabledText={!f.textSelected}
          onTool={f.onTool}
        />
      </KeyboardAvoidingView>

      <TextAnalysisSheet
        visible={sheet === 'analysis'}
        blocks={blocks}
        typing={{ cpm: metrics.typingCpm, wpm: metrics.typingWpm }}
        onClose={() => setSheet(null)}
      />
      <OutlineSheet
        visible={sheet === 'outline'}
        blocks={blocks}
        styles={draft.styles}
        onJump={jump}
        onClose={() => setSheet(null)}
      />
      <MetricPickerSheet visible={sheet === 'metrics'} onClose={() => setSheet(null)} />
      <CommentSheet visible={f.commentOpen} onAdd={f.addComment} onClose={f.closeComment} />
      <ItemMetaSheet
        visible={sheet === 'meta'}
        itemId={p.docId}
        title={shownTitle}
        onClose={() => setSheet(null)}
      />
      <PromoteSheet
        visible={sheet === 'promote'}
        noteTitle={shownTitle}
        onClose={() => setSheet(null)}
        onPick={(n, sId) => {
          setSheet(null);
          void draft.flush().then(() => promote(p.docId, n, sId));
        }}
      />
    </View>
  );
}
