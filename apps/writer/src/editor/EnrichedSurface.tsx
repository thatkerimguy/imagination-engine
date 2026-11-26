// Native rich surface over Software Mansion's EnrichedMarkdownTextInput: true WYSIWYG bold /
// italic / underline / strike with native autocorrect, cross-paragraph selection and a caret
// that lands where the finger taps. The input is uncontrolled, so external edits (undo, find &
// replace, mention inserts) are pushed with setValue only when they differ from what it emitted.
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  EnrichedMarkdownTextInput,
  type EnrichedMarkdownTextInputInstance,
  type StyleState,
} from 'react-native-enriched-markdown';
import { useTheme } from '../ui/theme.tsx';
import type { Selection } from './inline-edit.ts';
import { fromEnriched, plainToSource, sourceToPlain, toEnriched } from './markdown-bridge.ts';
import type { RichSurfaceHandle, RichSurfaceProps } from './rich-surface-types.ts';

export function EnrichedSurface(p: RichSurfaceProps): ReactNode {
  const { colors } = useTheme();
  const input = useRef<EnrichedMarkdownTextInputInstance | null>(null);
  const emitted = useRef(p.value);
  const last = useRef<Selection>({ start: p.value.length, end: p.value.length });
  const latest = useRef(p);
  latest.current = p;

  useEffect(() => {
    if (p.value === emitted.current) return;
    emitted.current = p.value;
    input.current?.setValue(toEnriched(p.value));
  }, [p.value]);

  useEffect(() => {
    const sel = p.selection;
    if (!sel) return;
    const l = last.current;
    if (l.start === sel.start && l.end === sel.end) return;
    last.current = sel;
    const src = emitted.current;
    input.current?.setSelection(sourceToPlain(src, sel.start), sourceToPlain(src, sel.end));
  }, [p.selection]);

  const handle = useMemo<RichSurfaceHandle>(
    () => ({
      native: true,
      focus: () => input.current?.focus(),
      toggleBold: () => input.current?.toggleBold(),
      toggleItalic: () => input.current?.toggleItalic(),
      toggleUnderline: () => input.current?.toggleUnderline(),
      toggleStrike: () => input.current?.toggleStrikethrough(),
      setHeading: (level) => input.current?.toggleHeading(level),
      toggleBulletList: () => input.current?.toggleUnorderedList(),
      insertText: (text) => input.current?.insertText(text),
      getSelection: () => last.current,
    }),
    [],
  );
  useEffect(() => {
    latest.current.onHandle?.(handle);
    return () => latest.current.onHandle?.(null);
  }, [handle]);

  const onState = (s: StyleState): void =>
    p.onActiveFormatsChange?.({
      bold: s.bold.isActive,
      italic: s.italic.isActive,
      underline: s.underline.isActive,
      strike: s.strikethrough.isActive,
    });

  return (
    <EnrichedMarkdownTextInput
      ref={input}
      defaultValue={toEnriched(p.value)}
      multiline
      scrollEnabled={false}
      markdownShortcuts={false}
      autoFocus={p.autoFocus}
      autoCapitalize="sentences"
      placeholder={p.placeholder}
      placeholderTextColor={colors.inkMuted}
      cursorColor={colors.accent}
      selectionColor={colors.accent}
      selectionMenuConfig={{ copyAsMarkdown: { enabled: false } }}
      formatMenuConfig={{ spoiler: { enabled: false }, link: { enabled: false } }}
      linkRegex={null}
      testID={p.testID}
      onFocus={p.onFocus}
      onBlur={p.onBlur}
      onChangeMarkdown={(md) => {
        const src = fromEnriched(md);
        if (src === emitted.current) return;
        emitted.current = src;
        latest.current.onChangeText(src);
      }}
      onChangeSelection={({ start, end }) => {
        const src = emitted.current;
        const sel = { start: plainToSource(src, start), end: plainToSource(src, end) };
        last.current = sel;
        latest.current.onSelectionChange(sel);
      }}
      onChangeState={onState}
      style={[{ minHeight: p.minHeight, padding: 0, color: colors.ink }, p.textStyle]}
    />
  );
}
