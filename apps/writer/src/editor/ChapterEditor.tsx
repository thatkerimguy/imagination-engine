import type { ChapterDocument } from '@kn/core';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shareJson } from '../export/share-json';
import { GimmickSheet } from '../forms/GimmickSheet.tsx';
import { getWriterModule, enabledWriterModules } from '../modules/registry.ts';
import { replaceBlock } from '../store/chapter-ops.ts';
import type { ChapterDraft } from '../store/use-chapter-draft.ts';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/layout';
import { colors, fonts, space } from '../ui/legacy-theme.ts';
import { BlockView } from './BlockView.tsx';
import { InsertBar } from './InsertBar.tsx';
import { GimmickPicker, InsertChoiceSheet } from './InsertSheets.tsx';
import { useEditorActions } from './use-editor-actions.ts';

export interface ChapterEditorProps {
  chapter: ChapterDocument;
  update: ChapterDraft['update'];
  enabledModules: readonly string[];
  /** Reports the selected block so the header can start Preview there. */
  onSelectionChange(id: string | null): void;
}

export function ChapterEditor(p: ChapterEditorProps): ReactNode {
  const { chapter, update } = p;
  const insets = useSafeAreaInsets();
  const a = useEditorActions(update);
  const select = (id: string | null): void => {
    a.select(id);
    p.onSelectionChange(id);
  };
  const sheetBlock = chapter.blocks.find((b) => b.id === a.sheetId);
  const sheetModule =
    sheetBlock?.kind === 'module' ? getWriterModule(sheetBlock.moduleId) : undefined;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + 44}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        testID="chapter-stream"
      >
        <Text style={styles.title} accessibilityRole="header">
          {chapter.title}
        </Text>
        {chapter.blocks.length === 0 ? (
          <EmptyState
            title="A blank page"
            body="Use the bar below to add prose, dialogue, a scene break or a gimmick."
          />
        ) : null}
        {chapter.blocks.map((block) => (
          <BlockView
            key={block.id}
            block={block}
            selected={a.selectedId === block.id}
            autoFocus={a.focusId === block.id}
            moduleEnabled={block.kind !== 'module' || p.enabledModules.includes(block.moduleId)}
            onSelect={select}
            onChange={a.change}
            onOpenGimmick={a.openSheet}
            onToggleBeat={a.toggleBeat}
            onMove={a.move}
            onInsertBelow={a.openBelow}
            onDelete={(id) => void a.remove(id)}
          />
        ))}
        <View style={styles.footer}>
          <Button
            compact
            variant="ghost"
            label="Export chapter JSON"
            testID="export-chapter"
            onPress={() => void shareJson(`${chapter.id}.json`, chapter)}
          />
        </View>
      </ScrollView>
      <InsertBar onPick={(choice) => a.pick(choice, a.selectedId)} />
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
            update((c) =>
              replaceBlock(c, {
                ...sheetBlock,
                moduleVersion: sheetModule.meta.version,
                props,
              }),
            );
            a.openSheet(null);
          }}
          onClose={() => a.openSheet(null)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.sm, paddingBottom: space.xl * 2 },
  title: {
    color: colors.fg,
    fontFamily: fonts.prose,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: space.md,
  },
  footer: { alignItems: 'center', paddingTop: space.xl },
});
