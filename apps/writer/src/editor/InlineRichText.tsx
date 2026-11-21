// Unfocused WYSIWYG rendering of writer markup: nested <Text> runs, block styling, and never any
// raw syntax (comments show as a small marker).
import { useMemo, type ReactNode } from 'react';
import { Text, View, type StyleProp, type TextStyle } from 'react-native';
import type { BlockStyle } from '../store/chapter-styles.ts';
import { space, withAlpha } from '../ui/tokens.ts';
import { makeStyles, useTheme } from '../ui/theme.tsx';
import { HEADING_SCALE, type EditorTypography } from '../ui/typography.ts';
import { inlineRuns, type InlineRun } from './inline-markup.ts';

export interface InlineRichTextProps {
  text: string;
  style?: BlockStyle;
  typography: EditorTypography;
  baseStyle?: StyleProp<TextStyle>;
  testID?: string;
}

const useStyles = makeStyles((t) => ({
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: t.colors.accent,
    paddingLeft: space.md,
  },
  listRow: { flexDirection: 'row' },
  listBody: { flex: 1 },
}));

/** Size, weight and alignment shared with the focused input so the two states line up. */
export function blockTextStyle(style: BlockStyle | undefined, typo: EditorTypography): TextStyle {
  const heading = style?.heading;
  const size = heading ? Math.round(typo.fontSize * HEADING_SCALE[heading]) : typo.fontSize;
  return {
    fontFamily: typo.fontFamily,
    fontSize: size,
    lineHeight: heading ? Math.round(typo.lineHeight * HEADING_SCALE[heading]) : typo.lineHeight,
    textAlign: style?.align ?? typo.defaultAlign,
    ...(heading ? { fontWeight: '700' } : null),
  };
}

export function InlineRichText(p: InlineRichTextProps): ReactNode {
  const { colors } = useTheme();
  const s = useStyles();
  const st = p.style;
  const indent = !!(st?.indent || p.typography.firstLineIndent) && !st?.heading && !st?.list;
  const runs = useMemo(() => inlineRuns(p.text), [p.text]);

  const runStyle = (r: InlineRun): TextStyle => {
    const deco = [r.underline && 'underline', r.strike && 'line-through'].filter(Boolean);
    return {
      ...(r.bold ? { fontWeight: '700' } : null),
      ...(r.italic ? { fontStyle: 'italic' } : null),
      ...(deco.length
        ? { textDecorationLine: deco.join(' ') as TextStyle['textDecorationLine'] }
        : null),
      ...(r.highlight ? { backgroundColor: withAlpha(colors.warm, 0.3) } : null),
      ...(r.fg ? { color: r.fg } : null),
      ...(r.bg ? { backgroundColor: r.bg } : null),
    };
  };

  const body = (
    <Text
      testID={p.testID}
      style={[
        blockTextStyle(st, p.typography),
        { color: st?.fgColor ?? colors.ink },
        st?.bgColor ? { backgroundColor: st.bgColor } : null,
        st?.quote ? { fontStyle: 'italic', color: st.fgColor ?? colors.inkSecondary } : null,
        p.baseStyle,
      ]}
    >
      {indent ? '  ' : null}
      {runs.map((r, i) =>
        r.comment !== undefined ? (
          <Text
            key={i}
            accessibilityLabel={`Comment: ${r.comment}`}
            style={{ color: colors.warm, fontSize: p.typography.fontSize * 0.6 }}
          >
            {'\u{1F4AC}'}
          </Text>
        ) : (
          <Text key={i} style={runStyle(r)}>
            {r.text}
          </Text>
        ),
      )}
    </Text>
  );

  let out: ReactNode = body;
  if (st?.list === 'bullet') {
    out = (
      <View style={s.listRow}>
        <Text style={[blockTextStyle(st, p.typography), { color: colors.ink }]}>{'•  '}</Text>
        <View style={s.listBody}>{body}</View>
      </View>
    );
  }
  return st?.quote ? <View style={s.quote}>{out}</View> : out;
}
