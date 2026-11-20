// Hybrid block text: rendered WYSIWYG when unfocused, raw-markup multiline TextInput when focused.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, type StyleProp, type TextStyle } from 'react-native';
import type { BlockStyle } from '../store/chapter-styles.ts';
import { GrowingTextInput } from '../ui/GrowingTextInput.tsx';
import { AppText } from '../ui/AppText.tsx';
import { makeStyles, useTheme } from '../ui/theme.tsx';
import { useEditorTypography } from '../ui/typography.ts';
import { InlineRichText, blockTextStyle } from './InlineRichText.tsx';
import type { Selection } from './inline-edit.ts';

export interface RichProseInputProps {
  text: string;
  blockStyle?: BlockStyle;
  focused: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  samsungSafeIme: boolean;
  selection?: Selection;
  onFocus(): void;
  onChangeText(text: string): void;
  onSelectionChange(sel: Selection): void;
  /** Extra text style (e.g. whisper / emphasis) applied in both states. */
  baseStyle?: StyleProp<TextStyle>;
  testID?: string;
}

const useStyles = makeStyles(() => ({
  idle: { minHeight: 26 },
  input: { padding: 0 },
}));

export function RichProseInput(p: RichProseInputProps): ReactNode {
  const typo = useEditorTypography();
  const { m3 } = useTheme();
  const s = useStyles();
  // Last selection pushed to the native input. Re-sending a controlled selection on every render
  // makes some Android IMEs jump the caret, so a `selection` prop is forwarded to the TextInput
  // only once per change, then released again on the next user-driven selection event.
  const applied = useRef<Selection | undefined>(undefined);
  const last = useRef<Selection | undefined>(undefined);
  const [forced, setForced] = useState<Selection | undefined>(undefined);

  useEffect(() => {
    if (!p.focused) {
      applied.current = undefined;
      setForced(undefined);
      return;
    }
    const sel = p.selection;
    if (!sel) return;
    const a = applied.current;
    if (a && a.start === sel.start && a.end === sel.end) return;
    applied.current = sel;
    const l = last.current;
    if (l && l.start === sel.start && l.end === sel.end) return; // already where the user is
    setForced(sel);
  }, [p.focused, p.selection]);

  if (!p.focused) {
    return (
      <Pressable
        onPress={p.onFocus}
        accessibilityRole="button"
        accessibilityLabel={p.text ? 'Edit text' : (p.placeholder ?? 'Edit text')}
        testID={p.testID}
        style={s.idle}
      >
        {p.text ? (
          <InlineRichText
            text={p.text}
            style={p.blockStyle}
            typography={typo}
            baseStyle={p.baseStyle}
          />
        ) : (
          <AppText
            color="onSurfaceVariant"
            style={[blockTextStyle(p.blockStyle, typo), p.baseStyle]}
          >
            {p.placeholder ?? ''}
          </AppText>
        )}
      </Pressable>
    );
  }

  const base = blockTextStyle(p.blockStyle, typo);
  const ime = p.samsungSafeIme ? { autoCorrect: false, spellCheck: false } : null;
  return (
    <GrowingTextInput
      {...ime}
      minHeight={typo.lineHeight}
      autoFocus={p.autoFocus ?? true}
      value={p.text}
      {...(forced ? { selection: forced } : null)}
      testID={p.testID}
      onFocus={p.onFocus}
      onChangeText={p.onChangeText}
      onSelectionChange={(e) => {
        const { start, end } = e.nativeEvent.selection;
        last.current = { start, end };
        if (forced) setForced(undefined);
        p.onSelectionChange({ start, end });
      }}
      placeholder={p.placeholder}
      placeholderTextColor={m3.onSurfaceVariant}
      textAlignVertical="top"
      style={[s.input, base, p.baseStyle, { color: p.blockStyle?.fgColor ?? m3.onSurface }]}
    />
  );
}
