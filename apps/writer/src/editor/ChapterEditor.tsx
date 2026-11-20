import type { ChapterDocument } from '@kn/core';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shareJson } from '../export/share-json';
import { GimmickSheet } from '../forms/GimmickSheet.tsx';
import { getWriterModule, enabledWriterModules } from '../modules/registry.ts';
import { replaceBlock } from '../store/chapter-ops.ts';
import type { ChapterDraft } from '../store/use-chapter-draft.ts';
import { AppText } from '../ui/AppText.tsx';
import { Button } from '../ui/Button.tsx';
import { EmptyState } from '../ui/layout.tsx';
import { proseFont, space } from '../ui/m3-tokens.ts';
import { makeStyles } from '../ui/theme.tsx';
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
  const styles = useStyles();
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
        <AppText variant="headlineSmall" style={styles.title} accessibilityRole="header">
          {chapter.title}
        </AppText>
        {chapter.blocks.length === 0 ? (
          <EmptyState
            icon="edit-note"
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
            variant="text"
            icon="ios-share"
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

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.surface },
  content: { padding: space.lg, gap: space.sm, paddingBottom: space.xl * 2 },
  title: { fontFamily: proseFont, fontSize: 26, lineHeight: 34, fontWeight: '700' },
  footer: { alignItems: 'center', paddingTop: space.xl },
}));
