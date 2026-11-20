// Collapsible find & replace bar over the chapter's prose and dialogue text.
import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import type { ChapterDocument } from '@kn/core';
import { AppText } from '../ui/AppText.tsx';
import { Button } from '../ui/Button.tsx';
import { IconButton } from '../ui/IconButton.tsx';
import { space } from '../ui/m3-tokens.ts';
import { TextField } from '../ui/TextField.tsx';
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
    backgroundColor: t.m3.surfaceContainer,
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
    gap: space.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  grow: { flex: 1 },
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
      <View style={s.row}>
        <View style={s.grow}>
          <TextField
            dense
            value={query}
            onChangeText={(v) => {
              setQuery(v);
              setCursor(0);
            }}
            placeholder="Find"
            autoFocus
            testID="find-input"
          />
        </View>
        <AppText variant="labelMedium" color="onSurfaceVariant" testID="find-counter">
          {matches.length ? `${at + 1}/${matches.length}` : '0/0'}
        </AppText>
        <IconButton
          icon="keyboard-arrow-up"
          size={32}
          accessibilityLabel="Previous match"
          onPress={() => go(-1)}
          testID="find-prev"
        />
        <IconButton
          icon="keyboard-arrow-down"
          size={32}
          accessibilityLabel="Next match"
          onPress={() => go(1)}
          testID="find-next"
        />
        <IconButton
          icon="find-replace"
          size={32}
          selected={showReplace}
          accessibilityLabel="Toggle replace"
          onPress={() => setShowReplace((v) => !v)}
          testID="find-toggle-replace"
        />
        <IconButton
          icon="close"
          size={32}
          accessibilityLabel="Close find"
          onPress={p.onClose}
          testID="find-close"
        />
      </View>
      {showReplace ? (
        <View style={s.row}>
          <View style={s.grow}>
            <TextField
              dense
              value={repl}
              onChangeText={setRepl}
              placeholder="Replace with"
              testID="replace-input"
            />
          </View>
          <Button
            label="Replace"
            variant="text"
            disabled={at < 0}
            onPress={doReplace}
            testID="replace-one"
          />
          <Button
            label="All"
            variant="text"
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
