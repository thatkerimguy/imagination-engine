// Standalone note editor: the chapter editor's prose / dialogue / scene-break experience (toolbar,
// metrics, find & replace, outline, analysis, undo/redo) on the shared UnifiedBlocks stream, plus a
// Backlinks panel, over a note — no gimmicks, no preview.
import { useCallback, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useNoteEditorStyles } from './note-editor-styles.ts';
import { FindReplaceBar } from '../editor/FindReplaceBar.tsx';
import { FormattingToolbar } from '../editor/FormattingToolbar.tsx';
import { MetricsRibbon } from '../editor/MetricsRibbon.tsx';
import { UnifiedBlocks } from '../editor/UnifiedBlocks.tsx';
import { useBlockHandlers } from '../editor/use-block-handlers.ts';
import { useKeyboardDock } from '../editor/use-keyboard-dock';
import { useLiveMetrics } from '../editor/use-live-metrics.ts';
import { useScrolledFlag } from '../editor/use-scrolled-flag.ts';
import { useEditorCore } from '../editor/use-unified-editing.ts';
import { ColorPopover } from '../editor/EditorChrome.tsx';
import { Field } from '../ui/Field.tsx';
import type { MenuItem } from '../ui/PopoverMenu.tsx';
import { useOpenBacklink } from './backlink-nav.ts';
import { BacklinksSection } from './BacklinksSection.tsx';
import { useWriterPrefs } from '../ui/theme.tsx';
import { useBackIntercept } from '../ui/use-back-intercept.ts';
import { useToolbarCollapse } from '../ui/use-toolbar-collapse.ts';
import { useEditorTypography } from '../ui/typography.ts';
import { NoteTopBar } from './NoteTopBar.tsx';
import { usePromote } from './promote.ts';
import { NoteSheets, type NoteSheet } from './NoteSheets.tsx';
import type { NoteDraft } from './use-note-draft.ts';
import { useLayoutClass } from '../ui/use-layout-class.ts';

export interface NoteEditorProps {
  docId: string;
  draft: NoteDraft;
  onBack(): void;
  onGrowth(): void;
  /** Appended to the ⋯ menu (e.g. "Version history"). */
  extraMenu?: MenuItem[];
}

const NO_MODULES: readonly string[] = [];

export function NoteEditor(p: NoteEditorProps): ReactNode {
  const { draft } = p;
  const s = useNoteEditorStyles();
  const typo = useEditorTypography();
  const [prefs] = useWriterPrefs();
  const promote = usePromote();
  const chapter = draft.chapter;
  const blocks = draft.blocks ?? [];
  const { a, f, u } = useEditorCore({
    blocks,
    draft,
    mode: 'note',
    hiddenTools: prefs.hiddenTools,
    defaultAlign: typo.defaultAlign,
  });
  const openBacklink = useOpenBacklink();
  const [sheet, setSheet] = useState<NoteSheet>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [scrolled, onScroll] = useScrolledFlag();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const h = useBlockHandlers(a, scroller, undefined);
  const metrics = useLiveMetrics(blocks);
  const dock = useKeyboardDock();
  useBackIntercept([
    { open: f.colorFor !== null, close: f.closeColor },
    { open: findOpen, close: () => setFindOpen(false) },
  ]);
  const onCollapse = useToolbarCollapse();
  const toggleRibbon = useCallback(() => setCollapsed((c) => !c), []);
  const openAnalysis = useCallback(() => setSheet('analysis'), []);
  const openMetrics = useCallback(() => setSheet('metrics'), []);
  const { jump } = h;
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

  const wideWindow = useLayoutClass() !== 'compact';
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
          contentContainerStyle={[
            s.content,
            { paddingHorizontal: typo.margin },
            wideWindow && s.measure,
          ]}
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
            disableFullscreenUI
            testID="note-title"
          />
          <UnifiedBlocks
            {...h}
            blocks={blocks}
            selectedId={a.selectedId}
            focusId={a.focusId}
            enabledModules={NO_MODULES}
            styles={draft.styles}
            includeCues={u.caps.cues}
            samsungSafeIme={prefs.samsungSafeIme}
            forcedSelection={f.forcedSelection}
            onSelectionChange={f.onSelectionChange}
            onRunChange={u.onRunChange}
            tools={u.tools}
          />
          {u.caps.backlinks ? <BacklinksSection targetId={p.docId} onOpen={openBacklink} /> : null}
        </ScrollView>
        {f.colorFor ? (
          <ColorPopover channel={f.colorFor} onPick={f.pickColor} onClose={f.closeColor} />
        ) : null}
        <FormattingToolbar
          order={prefs.toolbarOrder}
          hidden={u.hiddenTools}
          active={u.active}
          align={f.align}
          disabledText={!f.textSelected}
          onTool={u.onTool}
          formatCollapsed={prefs.toolbarFormatCollapsed}
          addCollapsed={prefs.toolbarAddCollapsed}
          onCollapse={onCollapse}
          keyboardOpen={dock.keyboardOpen}
        />
        <dock.Spacer />
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
