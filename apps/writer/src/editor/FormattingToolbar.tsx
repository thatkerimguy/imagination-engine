// Folio formatting bar: a 44dp `surface` strip with a 1px top hairline, monochrome 18px glyphs and
// the add-block tools pinned right. Buttons refuse focus so the keyboard and the TextInput
// selection survive a tap.
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { ToolId } from '../store/writer-prefs.ts';
import { Glyph, type GlyphName } from '../ui/Glyph.tsx';
import { Txt } from '../ui/Txt.tsx';
import { radius, space, TOUCH } from '../ui/tokens.ts';
import { makeStyles } from '../ui/theme.tsx';

type Align = 'left' | 'center' | 'right';

export interface FormattingToolbarProps {
  order: ToolId[];
  hidden: ToolId[];
  active: Partial<Record<ToolId, boolean>>;
  align: Align;
  disabledText?: boolean;
  onTool(id: ToolId): void;
}

type Face = { icon: GlyphName } | { text: string };

const FACES: Readonly<Record<ToolId, Face>> = {
  tab: { icon: 'chevrons-right' },
  bold: { icon: 'bold' },
  italic: { icon: 'italic' },
  underline: { icon: 'underline' },
  strike: { text: 'S' },
  highlight: { icon: 'edit-2' },
  h1: { text: 'H1' },
  h2: { text: 'H2' },
  h3: { text: 'H3' },
  align: { icon: 'align-left' },
  quote: { text: '\u201C' },
  bullet: { icon: 'list' },
  fgColor: { icon: 'type' },
  bgColor: { icon: 'droplet' },
  comment: { icon: 'message-circle' },
  separator: { text: '\u2014' },
  addProse: { icon: 'plus' },
  addDialogue: { icon: 'message-square' },
  addScene: { icon: 'more-horizontal' },
  addGimmick: { icon: 'zap' },
};

/** Add-block tools sit pinned at the right edge, outside the scrolling strip. */
const ADD_TOOLS: ReadonlySet<ToolId> = new Set<ToolId>([
  'addProse',
  'addDialogue',
  'addScene',
  'addGimmick',
]);

const LABELS: Readonly<Record<ToolId, string>> = {
  tab: 'Tab',
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strike: 'Strikethrough',
  highlight: 'Highlight',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  align: 'Alignment',
  quote: 'Quote',
  bullet: 'Bulleted list',
  fgColor: 'Text colour',
  bgColor: 'Background colour',
  comment: 'Comment',
  separator: 'Separator',
  addProse: 'Add prose block',
  addDialogue: 'Add dialogue block',
  addScene: 'Add scene break',
  addGimmick: 'Add gimmick',
};

const TEXT_TOOLS: ReadonlySet<ToolId> = new Set<ToolId>([
  'tab',
  'bold',
  'italic',
  'underline',
  'strike',
  'highlight',
  'h1',
  'h2',
  'h3',
  'align',
  'quote',
  'bullet',
  'fgColor',
  'bgColor',
  'comment',
  'separator',
]);

export const toolLabel = (id: ToolId): string => LABELS[id];
export const toolFace = (id: ToolId): Face => FACES[id];

const useStyles = makeStyles((t) => ({
  bar: {
    height: TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.colors.surface,
    borderTopWidth: 1,
    borderColor: t.colors.hairline,
  },
  scroll: { flex: 1 },
  content: { paddingLeft: space.xxs, paddingRight: 12, alignItems: 'center' },
  pinned: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.xxs,
    borderLeftWidth: 1,
    borderColor: t.colors.hairline,
  },
  btn: {
    minWidth: TOUCH,
    height: TOUCH,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: { backgroundColor: t.colors.surfaceTint },
  off: { opacity: 0.38 },
  text: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
}));

export function FormattingToolbar(p: FormattingToolbarProps): ReactNode {
  const s = useStyles();
  const tools = p.order.filter((id) => !p.hidden.includes(id));
  return (
    <View style={s.bar} testID="formatting-toolbar">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        style={s.scroll}
        contentContainerStyle={s.content}
      >
        {tools
          .filter((id) => !ADD_TOOLS.has(id))
          .map((id) => (
            <ToolButton key={id} id={id} {...p} />
          ))}
      </ScrollView>
      <View style={s.pinned}>
        {tools
          .filter((id) => ADD_TOOLS.has(id))
          .map((id) => (
            <ToolButton key={id} id={id} {...p} />
          ))}
      </View>
    </View>
  );
}

function ToolButton(p: FormattingToolbarProps & { id: ToolId }): ReactNode {
  const s = useStyles();
  const { id } = p;
  const face = FACES[id];
  const glyph: GlyphName | undefined =
    id === 'align' ? `align-${p.align}` : 'icon' in face ? face.icon : undefined;
  const on = !!p.active[id];
  const disabled = !!p.disabledText && TEXT_TOOLS.has(id);
  const color = on ? 'accent' : 'inkSecondary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={LABELS[id]}
      accessibilityState={{ selected: on, disabled }}
      disabled={disabled}
      focusable={false}
      onPress={() => p.onTool(id)}
      testID={`tool-${id}`}
      style={({ pressed }) => [s.btn, (on || pressed) && s.on, disabled && s.off]}
    >
      {glyph ? <Glyph name={glyph} size={18} color={color} /> : null}
      {'text' in face ? (
        <Txt style={s.text} color={color}>
          {face.text}
        </Txt>
      ) : null}
    </Pressable>
  );
}

export const COLOR_PRESETS: readonly string[] = [
  '#e53935',
  '#fb8c00',
  '#fdd835',
  '#43a047',
  '#1e88e5',
  '#8e24aa',
  '#6d4c41',
  '#212121',
];

/** Eight preset swatches for fg/bg colouring; touch-safe (keeps the input focused). */
export function ColorSwatchRow(p: {
  onPick(hex: string): void;
  colors?: readonly string[];
}): ReactNode {
  const list = p.colors ?? COLOR_PRESETS;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }} testID="color-swatches">
      {list.map((hex) => (
        <Pressable
          key={hex}
          accessibilityRole="button"
          accessibilityLabel={`Colour ${hex}`}
          focusable={false}
          onPress={() => p.onPick(hex)}
          testID={`swatch-${hex.slice(1)}`}
          style={{ width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: hex,
              borderWidth: 1,
              borderColor: 'rgba(128,128,128,0.5)',
            }}
          />
        </Pressable>
      ))}
    </View>
  );
}
