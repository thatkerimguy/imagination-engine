// Collapsible find & replace bar over the chapter's prose and dialogue text.
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ChapterDocument } from '@kn/core';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Field } from '../ui/Field.tsx';
import { IconBtn } from '../ui/IconBtn.tsx';
import { Txt } from '../ui/Txt.tsx';
import { space } from '../ui/tokens.ts';
import { makeStyles } from '../ui/theme.tsx';
import { findMatches, replaceAll, replaceOne } from './find-replace.ts';

export interface FindReplaceBarProps {
  chapter: ChapterDocument;
  onApply(next: ChapterDocument): void;
  onJump(blockId: string): void;
  onClose(): void;
}

const useStyles = makeStyles((t) => ({
  bar: {
    backgroundColor: t.colors.surface,
    borderBottomWidth: 1,
    borderColor: t.colors.hairline,
    paddingHorizontal: space.xs,
    paddingVertical: space.xs,
    gap: space.xs,
  },
}));

export function FindReplaceBar(p: FindReplaceBarProps): ReactNode {
  const s = useStyles();
  const [query, setQuery] = useState('');
  const [repl, setRepl] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [cursor, setCursor] = useState(0);
  const matches = useMemo(() => findMatches(p.chapter.blocks, query), [p.chapter.blocks, query]);
  const at = matches.length ? Math.min(cursor, matches.length - 1) : -1;

  const go = (d: 1 | -1): void => {
    if (!matches.length) return;
    const next = (at + d + matches.length) % matches.length;
    setCursor(next);
    p.onJump(matches[next]!.blockId);
  };
  const doReplace = (): void => {
    const m = matches[at];
    if (m) p.onApply(replaceOne(p.chapter, m, repl));
  };
  const doReplaceAll = (): void => {
    const r = replaceAll(p.chapter, query, repl);
    if (r.count) p.onApply(r.chapter);
  };

  return (
    <View style={s.bar} testID="find-replace-bar">
      <View style={styles.row}>
        <View style={styles.grow}>
          <Field
            dense
            value={query}
            onChangeText={(v) => {
              setQuery(v);
              setCursor(0);
            }}
            placeholder="Find"
            accessibilityLabel="Find"
            autoFocus
            testID="find-input"
          />
        </View>
        <Txt variant="caption" color="inkMuted" testID="find-counter">
          {matches.length ? `${at + 1}/${matches.length}` : '0/0'}
        </Txt>
        <IconBtn
          icon="chevron-up"
          box={32}
          size={16}
          accessibilityLabel="Previous match"
          onPress={() => go(-1)}
          testID="find-prev"
        />
        <IconBtn
          icon="chevron-down"
          box={32}
          size={16}
          accessibilityLabel="Next match"
          onPress={() => go(1)}
          testID="find-next"
        />
        <IconBtn
          icon="repeat"
          box={32}
          size={16}
          active={showReplace}
          accessibilityLabel="Toggle replace"
          onPress={() => setShowReplace((v) => !v)}
          testID="find-toggle-replace"
        />
        <IconBtn
          icon="x"
          box={32}
          size={16}
          accessibilityLabel="Close find"
          onPress={p.onClose}
          testID="find-close"
        />
      </View>
      {showReplace ? (
        <View style={styles.row}>
          <View style={styles.grow}>
            <Field
              dense
              value={repl}
              onChangeText={setRepl}
              placeholder="Replace with"
              accessibilityLabel="Replace with"
              testID="replace-input"
            />
          </View>
          <ActionButton
            label="Replace"
            variant="ghost"
            compact
            disabled={at < 0}
            onPress={doReplace}
            testID="replace-one"
          />
          <ActionButton
            label="All"
            variant="ghost"
            compact
            disabled={!matches.length}
            onPress={doReplaceAll}
            accessibilityLabel="Replace all"
            testID="replace-all"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
  grow: { flex: 1 },
});
