// Chapter editing screen (bar, metrics, blocks, toolbar, sheets); Focus Mode leaves page + Exit.
import type { Block, ChapterDocument } from '@kn/core';
import { useCallback, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { shareJson } from '../export/share-json';
import type { ChapterDraft } from '../store/use-chapter-draft.ts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton } from '../ui/ActionButton.tsx';
import { EmptyState } from '../ui/Page.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { useWriterPrefs } from '../ui/theme.tsx';
import { useBackIntercept } from '../ui/use-back-intercept.ts';
import { useToolbarCollapse } from '../ui/use-toolbar-collapse.ts';
import { useEditorTypography } from '../ui/typography.ts';
import { FOCUS_BOTTOM_PAD, useStyles } from './chapter-editor-styles.ts';
import { BlockView } from './BlockView.tsx';
import { ColorPopover, EditorTopBar, editorMenu } from './EditorChrome.tsx';
import { EditorSheets, type EditorSheet } from './EditorSheets.tsx';
import { FindReplaceBar } from './FindReplaceBar.tsx';
import { FormattingToolbar } from './FormattingToolbar.tsx';
import { FOCUS_EXIT_CLEARANCE, FocusExitPill } from './LayoutPrefsSheet.tsx';
import { MetricsRibbon } from './MetricsRibbon.tsx';
import { useEditorActions } from './use-editor-actions.ts';
import { useFormatActions } from './use-format-actions.ts';
import { useKeyboardDock } from './use-keyboard-dock.ts';
import { useLiveMetrics } from './use-live-metrics.ts';
import { useScrolledFlag } from './use-scrolled-flag.ts';

export interface ChapterEditorProps {
  chapter: ChapterDocument;
  draft: ChapterDraft;
  enabledModules: readonly string[];
  onBack(): void;
  /** Starts Preview, at the selected block when there is one. */
  onPreview(blockId: string | null): void;
  onGrowth(): void;
  onAppearance(): void;
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
  const offsets = useRef(new Map<string, number>());

  const metrics = useLiveMetrics(chapter.blocks);
  const dock = useKeyboardDock();
  useBackIntercept([
    { open: f.colorFor !== null, close: f.closeColor },
    { open: findOpen, close: () => setFindOpen(false) },
    { open: focusMode, close: () => setFocusMode(false) },
  ]);

  // Stable, id-taking handlers (via a ref to the latest actions) so memoized BlockViews skip renders.
  const actions = useRef(a);
  actions.current = a;
  const onChange = useCallback((b: Block) => actions.current.change(b), []);
  const onToggleBeat = useCallback((id: string) => actions.current.toggleBeat(id), []);
  const onMove = useCallback((id: string, d: -1 | 1) => actions.current.move(id, d), []);
  const onDelete = useCallback((id: string) => void actions.current.remove(id), []);
  const onOpenGimmick = useCallback((id: string) => actions.current.openSheet(id), []);
  const onSelect = useCallback((id: string) => actions.current.select(id), []);
  const onLayout = useCallback((id: string, y: number) => void offsets.current.set(id, y), []);

  const onCollapse = useToolbarCollapse();
  const toggleRibbon = useCallback(() => setRibbonCollapsed((c) => !c), []);
  const openAnalysis = useCallback(() => setSheet('analysis'), []);
  const openMetrics = useCallback(() => setSheet('metrics'), []);

  const jump = (id: string): void => {
    a.select(id);
    const y = offsets.current.get(id);
    if (y !== undefined)
      scroller.current?.scrollTo({ y: Math.max(0, y - space.xl), animated: true });
  };

  useEffect(() => {
    if (!p.initialBlockId) return;
    const t = setTimeout(() => jump(p.initialBlockId ?? ''), 350);
    return () => clearTimeout(t);
    // Only on open: a deep link jumps once.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
          menu={editorMenu({
            analysis: () => setSheet('analysis'),
            growth: p.onGrowth,
            find: () => setFindOpen(true),
            outline: () => setSheet('outline'),
            versions: () => setSheet('versions'),
            focus: () => setFocusMode(true),
            layout: () => setSheet('layout'),
            publish: () => setSheet('publish'),
            exportJson: () => void shareJson(`${chapter.id}.json`, chapter),
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
      {findOpen && chrome ? (
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
          {chapter.blocks.length === 0 ? (
            <EmptyState
              icon="edit-3"
              title="A blank page"
              body="Use the toolbar below to add prose, dialogue, a scene break or a gimmick."
            />
          ) : null}
          {chapter.blocks.map((block) => (
            <View key={block.id} onLayout={(e) => onLayout(block.id, e.nativeEvent.layout.y)}>
              <BlockView
                block={block}
                selected={a.selectedId === block.id}
                autoFocus={a.focusId === block.id}
                moduleEnabled={block.kind !== 'module' || p.enabledModules.includes(block.moduleId)}
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
      {focusMode ? <FocusExitPill onExit={() => setFocusMode(false)} /> : null}

      <EditorSheets
        sheet={sheet}
        setSheet={setSheet}
        chapter={chapter}
        draft={draft}
        metrics={metrics}
        jump={jump}
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
