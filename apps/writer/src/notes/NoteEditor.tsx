// Standalone note editor: the chapter editor's prose / dialogue / scene-break experience (toolbar,
// metrics, find & replace, outline, analysis, undo/redo) over a note — no gimmicks, no preview.
import type { Block } from '@kn/core';
import { useCallback, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { BlockView } from '../editor/BlockView.tsx';
import { useNoteEditorStyles } from './note-editor-styles.ts';
import { FindReplaceBar } from '../editor/FindReplaceBar.tsx';
import { FormattingToolbar } from '../editor/FormattingToolbar.tsx';
import { MetricsRibbon } from '../editor/MetricsRibbon.tsx';
import { useEditorActions } from '../editor/use-editor-actions.ts';
import { useFormatActions } from '../editor/use-format-actions.ts';
import { useKeyboardDock } from '../editor/use-keyboard-dock.ts';
import { useLiveMetrics } from '../editor/use-live-metrics.ts';
import { useScrolledFlag } from '../editor/use-scrolled-flag.ts';
import type { ToolId } from '../store/writer-prefs.ts';
import { ColorPopover } from '../editor/EditorChrome.tsx';
import { Field } from '../ui/Field.tsx';
import { EmptyState } from '../ui/Page.tsx';
import type { MenuItem } from '../ui/PopoverMenu.tsx';
import { space } from '../ui/tokens.ts';
import { useWriterPrefs } from '../ui/theme.tsx';
import { useBackIntercept } from '../ui/use-back-intercept.ts';
import { useToolbarCollapse } from '../ui/use-toolbar-collapse.ts';
import { useEditorTypography } from '../ui/typography.ts';
import { NoteTopBar } from './NoteTopBar.tsx';
import { usePromote } from './promote.ts';
import { NoteSheets, type NoteSheet } from './NoteSheets.tsx';
import type { NoteDraft } from './use-note-draft.ts';

export interface NoteEditorProps {
  docId: string;
  draft: NoteDraft;
  onBack(): void;
  onGrowth(): void;
  /** Appended to the ⋯ menu (e.g. "Version history"). */
  extraMenu?: MenuItem[];
}

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
  const [sheet, setSheet] = useState<NoteSheet>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [scrolled, onScroll] = useScrolledFlag();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const offsets = useRef(new Map<string, number>());
  const metrics = useLiveMetrics(blocks);
  const dock = useKeyboardDock();
  useBackIntercept([
    { open: f.colorFor !== null, close: f.closeColor },
    { open: findOpen, close: () => setFindOpen(false) },
  ]);
  const hiddenTools = useMemo<ToolId[]>(
    () => [...prefs.hiddenTools, 'addGimmick'],
    [prefs.hiddenTools],
  );
  const onCollapse = useToolbarCollapse();
  const toggleRibbon = useCallback(() => setCollapsed((c) => !c), []);
  const openAnalysis = useCallback(() => setSheet('analysis'), []);
  const openMetrics = useCallback(() => setSheet('metrics'), []);

  // Stable, id-taking handlers (via a ref to the latest actions) so memoized BlockViews skip renders.
  const actions = useRef(a);
  actions.current = a;
  const onChange = useCallback((b: Block) => actions.current.change(b), []);
  const onToggleBeat = useCallback((id: string) => actions.current.toggleBeat(id), []);
  const onMove = useCallback((id: string, d: -1 | 1) => actions.current.move(id, d), []);
  const onDelete = useCallback((id: string) => void actions.current.remove(id), []);
  const onSelect = useCallback((id: string) => actions.current.select(id), []);
  const onOpenGimmick = useCallback((): void => undefined, []);
  const onLayout = useCallback((id: string, y: number) => void offsets.current.set(id, y), []);

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
    <View style={s.screen} onLayout={dock.onRootLayout} testID="note-editor">
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
          onToggleCollapsed={toggleRibbon}
          onOpenAnalysis={openAnalysis}
          onCustomize={openMetrics}
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
      <View style={s.flex}>
        <ScrollView
          ref={scroller}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.content, { paddingHorizontal: typo.margin }]}
          scrollEventThrottle={32}
          onScroll={onScroll}
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
            <View key={block.id} onLayout={(e) => onLayout(block.id, e.nativeEvent.layout.y)}>
              <BlockView
                block={block}
                selected={a.selectedId === block.id}
                autoFocus={a.focusId === block.id}
                moduleEnabled
                blockStyle={draft.styles[block.id]}
                samsungSafeIme={prefs.samsungSafeIme}
                selection={f.forcedSelection(block.id)}
                onSelectionChange={f.onSelectionChange}
                onSelect={onSelect}
                onChange={onChange}
                onOpenGimmick={onOpenGimmick}
                onToggleBeat={onToggleBeat}
                onMove={onMove}
                onDelete={onDelete}
              />
            </View>
          ))}
        </ScrollView>
        {f.colorFor ? (
          <ColorPopover channel={f.colorFor} onPick={f.pickColor} onClose={f.closeColor} />
        ) : null}
        <FormattingToolbar
          order={prefs.toolbarOrder}
          hidden={hiddenTools}
          active={f.active}
          align={f.align}
          disabledText={!f.textSelected}
          onTool={f.onTool}
          formatCollapsed={prefs.toolbarFormatCollapsed}
          addCollapsed={prefs.toolbarAddCollapsed}
          onCollapse={onCollapse}
          keyboardOffset={dock.keyboardOffset}
          keyboardOpen={dock.keyboardOpen}
        />
      </View>

      <NoteSheets
        sheet={sheet}
        setSheet={setSheet}
        commentOpen={f.commentOpen}
        onAddComment={f.addComment}
        onCloseComment={f.closeComment}
        docId={p.docId}
        title={shownTitle}
        blocks={blocks}
        styles={draft.styles}
        metrics={metrics}
        jump={jump}
        onPromote={(x, y) => void draft.flush().then(() => promote(p.docId, x, y))}
      />
    </View>
  );
}
