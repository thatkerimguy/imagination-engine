// Chapter editing screen (bar, metrics, blocks, toolbar, sheets); Focus Mode leaves page + Exit.
import type { ChapterDocument } from '@kn/core';
import { useCallback, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { TeaserSheet } from '../teaser/TeaserSheet.tsx';
import { shareJson } from '../export/share-json';
import type { ChapterDraft } from '../store/use-chapter-draft.ts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton } from '../ui/ActionButton.tsx';
import { handleBackPress } from '../ui/back-layers.ts';
import { Txt } from '../ui/Txt.tsx';
import { useWriterPrefs } from '../ui/theme.tsx';
import { useBackIntercept } from '../ui/use-back-intercept.ts';
import { useLayoutClass } from '../ui/use-layout-class.ts';
import { useToolbarCollapse } from '../ui/use-toolbar-collapse.ts';
import { useEditorTypography } from '../ui/typography.ts';
import { FOCUS_BOTTOM_PAD, useStyles } from './chapter-editor-styles.ts';
import { ChapterBlocks } from './ChapterBlocks.tsx';
import { chapterMenu, ColorPopover, EditorTopBar } from './EditorChrome.tsx';
import { EditorQol } from './EditorQol.tsx';
import { EditorSheets, type EditorSheet } from './EditorSheets.tsx';
import { FindReplaceBar } from './FindReplaceBar.tsx';
import { FormattingToolbar } from './FormattingToolbar.tsx';
import { FOCUS_EXIT_CLEARANCE, FocusExitPill } from './LayoutPrefsSheet.tsx';
import { MetricsRibbon } from './MetricsRibbon.tsx';
import { ReferencePane } from './ReferencePane.tsx';
import { useBlockHandlers } from './use-block-handlers.ts';
import { useEditorActions } from './use-editor-actions.ts';
import { formatShortcuts, useEditorShortcuts } from './use-editor-shortcuts.ts';
import { useFormatActions } from './use-format-actions.ts';
import { useKeyboardDock } from './use-keyboard-dock.ts';
import { useLiveMetrics } from './use-live-metrics.ts';
import { useScrolledFlag } from './use-scrolled-flag.ts';
import { useStoryBible } from './use-story-bible.ts';

export interface ChapterEditorProps {
  chapter: ChapterDocument;
  draft: ChapterDraft;
  enabledModules: readonly string[];
  onBack(): void;
  /** Starts Preview, at the selected block when there is one. */
  onPreview(blockId: string | null): void;
  onGrowth(): void;
  onAppearance(): void;
  onTrash(): void;
  /** Scrolls to and selects this block once laid out (Search deep links). */
  initialBlockId?: string;
}
export function ChapterEditor(p: ChapterEditorProps): ReactNode {
  const { chapter, draft } = p;
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const typo = useEditorTypography();
  const [prefs] = useWriterPrefs();
  const a = useEditorActions(draft.update);
  const f = useFormatActions({
    blocks: chapter.blocks,
    styles: draft.styles,
    selectedId: a.selectedId,
    defaultAlign: typo.defaultAlign,
    update: draft.update,
    updateStyles: draft.updateStyles,
    pick: a.pick,
  });
  const [sheet, setSheet] = useState<EditorSheet>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [ribbonCollapsed, setRibbonCollapsed] = useState(false);
  const [scrolled, onScroll] = useScrolledFlag();
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const cls = useLayoutClass();
  const [refOpen, setRefOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [teaserOpen, setTeaserOpen] = useState(false);
  const bible = useStoryBible(f, chapter.blocks, a.selectedId, draft.update);
  const pane = refOpen && cls === 'expanded';
  const metrics = useLiveMetrics(chapter.blocks);
  const dock = useKeyboardDock();
  const layers = [
    { open: f.colorFor !== null, close: f.closeColor },
    { open: findOpen, close: () => setFindOpen(false) },
    { open: bible.visible, close: bible.close },
    { open: reading, close: () => setReading(false) },
    { open: pane, close: () => setRefOpen(false) },
    { open: focusMode, close: () => setFocusMode(false) },
  ];
  useBackIntercept(layers);
  const h = useBlockHandlers(a, scroller, p.initialBlockId);
  useEditorShortcuts({
    ...formatShortcuts(f.onTool, draft),
    find: () => setFindOpen((o) => !o),
    preview: () => p.onPreview(a.selectedId),
    shortcuts: () => setSheet('shortcuts'),
    escape: () => (sheet ? setSheet(null) : void handleBackPress(layers, false)),
  });
  const onCollapse = useToolbarCollapse();
  const toggleRibbon = useCallback(() => setRibbonCollapsed((c) => !c), []);
  const openAnalysis = useCallback(() => setSheet('analysis'), []);
  const openMetrics = useCallback(() => setSheet('metrics'), []);
  const chrome = !focusMode;
  return (
    <View style={s.screen} onLayout={dock.onRootLayout}>
      {chrome ? (
        <EditorTopBar
          words={metrics.words}
          status={draft.status}
          scrolled={scrolled}
          canUndo={draft.canUndo}
          canRedo={draft.canRedo}
          onBack={p.onBack}
          onStats={() => setSheet('analysis')}
          onUndo={draft.undo}
          onRedo={draft.redo}
          onPreview={() => p.onPreview(a.selectedId)}
          referenceOpen={refOpen}
          onReference={() => setRefOpen((o) => !o)}
          menu={chapterMenu(setSheet, {
            growth: p.onGrowth,
            find: () => setFindOpen(true),
            focus: () => setFocusMode(true),
            exportJson: () => void shareJson(`${chapter.id}.json`, chapter),
            trash: p.onTrash,
            readAloud: () => setReading(true),
            storyBible: bible.open,
            teaser: () => setTeaserOpen(true),
          })}
        />
      ) : null}
      {chrome && prefs.showMetricsRibbon ? (
        <MetricsRibbon
          metrics={metrics}
          visible={prefs.visibleMetrics}
          collapsed={ribbonCollapsed}
          onToggleCollapsed={toggleRibbon}
          onOpenAnalysis={openAnalysis}
          onCustomize={openMetrics}
        />
      ) : null}
      {chrome ? (
        <EditorQol
          blocks={chapter.blocks}
          reading={reading}
          onStopReading={() => setReading(false)}
          onActiveBlock={(i) => chapter.blocks[i] && h.jump(chapter.blocks[i].id)}
          bible={bible}
        />
      ) : null}
      {findOpen && chrome ? (
        <FindReplaceBar
          chapter={chapter}
          onApply={(next) => draft.update(() => next)}
          onJump={h.jump}
          onClose={() => setFindOpen(false)}
        />
      ) : null}
      <View style={[s.flex, s.row]}>
        <View style={s.flex}>
          <ScrollView
            ref={scroller}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              s.content,
              { paddingHorizontal: typo.margin },
              cls !== 'compact' && s.measure,
              focusMode && {
                paddingTop: insets.top + FOCUS_EXIT_CLEARANCE,
                paddingBottom: FOCUS_BOTTOM_PAD,
              },
            ]}
            scrollEventThrottle={32}
            onScroll={onScroll}
            testID="chapter-stream"
          >
            <Txt
              variant="title"
              style={[s.title, { fontFamily: typo.fontFamily }]}
              accessibilityRole="header"
            >
              {chapter.title}
            </Txt>
            <ChapterBlocks
              {...h}
              blocks={chapter.blocks}
              selectedId={a.selectedId}
              focusId={a.focusId}
              enabledModules={p.enabledModules}
              styles={draft.styles}
              samsungSafeIme={prefs.samsungSafeIme}
              forcedSelection={f.forcedSelection}
              onSelectionChange={f.onSelectionChange}
            />
            <View style={s.footer}>
              {focusMode ? null : (
                <ActionButton
                  variant="ghost"
                  quiet
                  icon="list"
                  label="Outline"
                  onPress={() => setSheet('outline')}
                />
              )}
            </View>
          </ScrollView>
          {chrome && f.colorFor ? (
            <ColorPopover channel={f.colorFor} onPick={f.pickColor} onClose={f.closeColor} />
          ) : null}
          {chrome ? (
            <FormattingToolbar
              order={prefs.toolbarOrder}
              hidden={prefs.hiddenTools}
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
          ) : null}
        </View>
        {pane && chrome ? (
          <ReferencePane
            blocks={chapter.blocks}
            styles={draft.styles}
            onJump={h.jump}
            onClose={() => setRefOpen(false)}
          />
        ) : null}
      </View>
      {focusMode ? <FocusExitPill onExit={() => setFocusMode(false)} /> : null}
      <TeaserSheet visible={teaserOpen} chapter={chapter} onClose={() => setTeaserOpen(false)} />
      <EditorSheets
        sheet={sheet}
        setSheet={setSheet}
        chapter={chapter}
        draft={draft}
        metrics={metrics}
        jump={h.jump}
        focusMode={focusMode}
        setFocusMode={setFocusMode}
        enabledModules={p.enabledModules}
        onAppearance={p.onAppearance}
        actions={a}
        format={f}
      />
    </View>
  );
}
