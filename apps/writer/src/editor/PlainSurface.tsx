// The plain rich surface: ONE always-live multiline input over a whole prose run, so a single tap
// places the caret where the finger landed (no tap-to-select, tap-again-to-edit). Used on web,
// and on native for runs the enriched editor cannot round-trip (see markdown-bridge.ts).
import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';
import { GrowingTextInput } from '../ui/GrowingTextInput.tsx';
import { useTheme } from '../ui/theme.tsx';
import { insertText, toggleMark, type EditResult, type Selection } from './inline-edit.ts';
import type { MarkKind } from './inline-markup.ts';
import type { RichSurfaceHandle, RichSurfaceProps } from './rich-surface-types.ts';

export function PlainSurface(p: RichSurfaceProps): ReactNode {
  const { colors } = useTheme();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  // Re-sending a controlled selection on every render makes some Android IMEs jump the caret,
  // so a `selection` prop is forwarded once per change and released on the next user event.
  const last = useRef<Selection>({ start: p.value.length, end: p.value.length });
  const applied = useRef<Selection | undefined>(undefined);
  const [forced, setForced] = useState<Selection | undefined>(undefined);
  const [focused, setFocused] = useState(false);
  const latest = useRef(p);
  latest.current = p;

  useEffect(() => {
    const sel = p.selection;
    if (!sel) return;
    const a = applied.current;
    if (a && a.start === sel.start && a.end === sel.end) return;
    applied.current = sel;
    const l = last.current;
    if (l.start !== sel.start || l.end !== sel.end) setForced(sel);
  }, [p.selection]);

  const handle = useMemo<RichSurfaceHandle>(() => {
    const edit = (fn: (text: string, sel: Selection) => EditResult): void => {
      const r = fn(latest.current.value, last.current);
      latest.current.onChangeText(r.text);
      last.current = r.selection;
      setForced(r.selection);
      latest.current.onSelectionChange(r.selection);
    };
    const mark = (m: MarkKind) => () => edit((t, s) => toggleMark(t, s, m));
    return {
      native: false,
      focus: () => input.current?.focus(),
      toggleBold: mark('bold'),
      toggleItalic: mark('italic'),
      toggleUnderline: mark('underline'),
      toggleStrike: mark('strike'),
      // Headings and lists are block styles here; the toolbar applies them to the block.
      setHeading: () => undefined,
      toggleBulletList: () => undefined,
      insertText: (text) => edit((t, s) => insertText(t, s, text)),
      getSelection: () => last.current,
    };
  }, []);
  useEffect(() => {
    latest.current.onHandle?.(handle);
    return () => latest.current.onHandle?.(null);
  }, [handle]);

  const ime = p.samsungSafeIme ? { autoCorrect: false, spellCheck: false } : null;
  // At rest the run reads WYSIWYG: the rendered text sits over the live input (its own glyphs
  // hidden) and lets the tap through, so one tap still focuses and places the caret.
  const resting = !focused && !!p.rest && p.value !== '';
  return (
    <View>
      <GrowingTextInput
        {...ime}
        ref={input}
        // Android landscape: keep typing in the live Folio layout, never the fullscreen extract box.
        disableFullscreenUI
        minHeight={p.minHeight}
        autoFocus={p.autoFocus}
        value={p.value}
        {...(forced ? { selection: forced } : null)}
        testID={p.testID}
        onFocus={() => {
          setFocused(true);
          p.onFocus();
        }}
        onBlur={() => {
          setFocused(false);
          p.onBlur?.();
        }}
        onChangeText={p.onChangeText}
        onSelectionChange={(e) => {
          const { start, end } = e.nativeEvent.selection;
          last.current = { start, end };
          if (forced) setForced(undefined);
          p.onSelectionChange({ start, end });
        }}
        placeholder={p.placeholder}
        placeholderTextColor={colors.inkMuted}
        selectionColor={colors.accent}
        textAlignVertical="top"
        style={[{ padding: 0, color: colors.ink }, p.textStyle, resting && styles.hidden]}
      />
      {resting ? (
        <View style={styles.rest} pointerEvents="none" testID={p.testID && `${p.testID}-view`}>
          {p.rest}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { color: 'transparent' },
  rest: { position: 'absolute', top: 0, left: 0, right: 0 },
});
