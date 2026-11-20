// The chapter editing screen: slim top bar, metrics ribbon, the block stream (WYSIWYG blocks that
// turn into inputs on focus), the above-keyboard formatting toolbar and every editor sheet.
// Focus Mode hides the bar, ribbon and toolbar, leaving the page and a small exit pill.
import type { ChapterDocument } from '@kn/core';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { shareJson } from '../export/share-json';
import { GimmickSheet } from '../forms/GimmickSheet.tsx';
import { enabledWriterModules, getWriterModule } from '../modules/registry.ts';
import { replaceBlock } from '../store/chapter-ops.ts';
import type { ChapterDraft } from '../store/use-chapter-draft.ts';
import { AppText } from '../ui/AppText.tsx';
import { Button } from '../ui/Button.tsx';
import { EmptyState } from '../ui/layout.tsx';
import { space } from '../ui/m3-tokens.ts';
import { makeStyles, useWriterPrefs } from '../ui/theme.tsx';
import { useEditorTypography } from '../ui/typography.ts';
import { TextAnalysisSheet } from '../views/TextAnalysisSheet.tsx';
import { BlockView } from './BlockView.tsx';
import { ColorPopover, CommentSheet, EditorTopBar, editorMenu } from './EditorChrome.tsx';
import { FindReplaceBar } from './FindReplaceBar.tsx';
import { FormattingToolbar } from './FormattingToolbar.tsx';
import { GimmickPicker, InsertChoiceSheet } from './InsertSheets.tsx';
import { FocusExitPill, LayoutPrefsSheet } from './LayoutPrefsSheet.tsx';
import { MetricPickerSheet, MetricsRibbon } from './MetricsRibbon.tsx';
import { OutlineSheet } from './OutlineSheet.tsx';
import { useEditorActions } from './use-editor-actions.ts';
import { useFormatActions } from './use-format-actions.ts';
import { useLiveMetrics } from './use-live-metrics.ts';

export interface ChapterEditorProps {
  chapter: ChapterDocument;
  draft: ChapterDraft;
  enabledModules: readonly string[];
  onBack(): void;
  /** Starts Preview, at the selected block when there is one. */
  onPreview(blockId: string | null): void;
  onGrowth(): void;
  onAppearance(): void;
}

type Sheet = 'analysis' | 'outline' | 'layout' | 'metrics' | null;

export function ChapterEditor(p: ChapterEditorProps): ReactNode {
  const { chapter, draft } = p;
  const s = useStyles();
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
  const [sheet, setSheet] = useState<Sheet>(null);
  const [findOpen, setFindOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [ribbonCollapsed, setRibbonCollapsed] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const offsets = useRef(new Map<string, number>());

  const metrics = useLiveMetrics(chapter.blocks);

  const jump = (id: string): void => {
    a.select(id);
    const y = offsets.current.get(id);
    if (y !== undefined)
      scroller.current?.scrollTo({ y: Math.max(0, y - space.xl), animated: true });
  };

  const sheetBlock = chapter.blocks.find((b) => b.id === a.sheetId);
  const sheetModule =
    sheetBlock?.kind === 'module' ? getWriterModule(sheetBlock.moduleId) : undefined;
  const chrome = !focusMode;

  return (
    <View style={s.screen}>
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
            focus: () => setFocusMode(true),
            layout: () => setSheet('layout'),
            exportJson: () => void shareJson(`${chapter.id}.json`, chapter),
          })}
        />
      ) : null}
      {chrome && prefs.showMetricsRibbon ? (
        <MetricsRibbon
          metrics={metrics}
          visible={prefs.visibleMetrics}
          collapsed={ribbonCollapsed}
          onToggleCollapsed={() => setRibbonCollapsed((c) => !c)}
          onOpenAnalysis={() => setSheet('analysis')}
          onCustomize={() => setSheet('metrics')}
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
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroller}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[s.content, { paddingHorizontal: typo.margin }]}
          scrollEventThrottle={32}
          onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 4)}
          testID="chapter-stream"
        >
          <AppText
            variant="headlineSmall"
            style={[s.title, { fontFamily: typo.fontFamily }]}
            accessibilityRole="header"
          >
            {chapter.title}
          </AppText>
          {chapter.blocks.length === 0 ? (
            <EmptyState
              icon="edit-note"
              title="A blank page"
              body="Use the toolbar below to add prose, dialogue, a scene break or a gimmick."
            />
          ) : null}
          {chapter.blocks.map((block) => (
            <View
              key={block.id}
              onLayout={(e) => offsets.current.set(block.id, e.nativeEvent.layout.y)}
            >
              <BlockView
                block={block}
                selected={a.selectedId === block.id}
                autoFocus={a.focusId === block.id}
                moduleEnabled={block.kind !== 'module' || p.enabledModules.includes(block.moduleId)}
                blockStyle={draft.styles[block.id]}
                samsungSafeIme={prefs.samsungSafeIme}
                selection={f.forcedSelection(block.id)}
                onSelectionChange={f.onSelectionChange}
                onSelect={a.select}
                onChange={a.change}
                onOpenGimmick={a.openSheet}
                onToggleBeat={a.toggleBeat}
                onMove={a.move}
                onInsertBelow={a.openBelow}
                onDelete={(id) => void a.remove(id)}
              />
            </View>
          ))}
          <View style={s.footer}>
            {focusMode ? null : (
              <Button
                variant="text"
                icon="toc"
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
          />
        ) : null}
      </KeyboardAvoidingView>
      {focusMode ? <FocusExitPill onExit={() => setFocusMode(false)} /> : null}

      <TextAnalysisSheet
        visible={sheet === 'analysis'}
        blocks={chapter.blocks}
        typing={{ cpm: metrics.typingCpm, wpm: metrics.typingWpm }}
        onClose={() => setSheet(null)}
      />
      <OutlineSheet
        visible={sheet === 'outline'}
        blocks={chapter.blocks}
        styles={draft.styles}
        onJump={jump}
        onClose={() => setSheet(null)}
      />
      <LayoutPrefsSheet
        visible={sheet === 'layout'}
        focusMode={focusMode}
        onFocusMode={(on) => {
          setFocusMode(on);
          if (on) setSheet(null);
        }}
        onClose={() => setSheet(null)}
        onOpenAppearance={() => {
          setSheet(null);
          p.onAppearance();
        }}
      />
      <MetricPickerSheet visible={sheet === 'metrics'} onClose={() => setSheet(null)} />
      <CommentSheet visible={f.commentOpen} onAdd={f.addComment} onClose={f.closeComment} />
      <InsertChoiceSheet
        visible={a.belowId !== null}
        onPick={(choice) => a.pick(choice, a.belowId)}
        onClose={() => a.openBelow(null)}
      />
      <GimmickPicker
        visible={a.pickerOpen}
        modules={enabledWriterModules(p.enabledModules)}
        onPick={a.pickModule}
        onClose={a.closePicker}
      />
      {sheetBlock?.kind === 'module' && sheetModule ? (
        <GimmickSheet
          visible
          module={sheetModule}
          initialProps={sheetBlock.props}
          disabledInNovel={!p.enabledModules.includes(sheetBlock.moduleId)}
          onSave={(props) => {
            draft.update((c) =>
              replaceBlock(c, { ...sheetBlock, moduleVersion: sheetModule.meta.version, props }),
            );
            a.openSheet(null);
          }}
          onClose={() => a.openSheet(null)}
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.surface },
  flex: { flex: 1 },
  content: { paddingTop: space.lg, gap: space.sm, paddingBottom: space.xl * 3 },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '700' },
  footer: { alignItems: 'center', paddingTop: space.xl },
}));
