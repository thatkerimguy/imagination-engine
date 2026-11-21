// Folio formatting bar: a 44dp `surface` strip with a 1px top hairline, monochrome 18px glyphs and
// the add-block tools pinned right. Buttons refuse focus so the keyboard and the TextInput
// selection survive a tap.
import { memo, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ToolId } from '../store/writer-prefs.ts';
import { Glyph, type GlyphName } from '../ui/Glyph.tsx';
import { Txt } from '../ui/Txt.tsx';
import { radius, space, TOUCH } from '../ui/tokens.ts';
import { makeStyles } from '../ui/theme.tsx';
import { ToolbarChevron, type ToolbarHalf } from './ToolbarCollapse.tsx';

type Align = 'left' | 'center' | 'right';

export interface FormattingToolbarProps {
  order: ToolId[];
  hidden: ToolId[];
  active: Partial<Record<ToolId, boolean>>;
  align: Align;
  disabledText?: boolean;
  onTool(id: ToolId): void;
  formatCollapsed?: boolean;
  addCollapsed?: boolean;
  /** Collapse (true) or expand (false) one toolbar half; the owner persists it. */
  onCollapse?(half: ToolbarHalf, collapsed: boolean): void;
  /** Extra bottom margin so the bar rides on the keyboard (from useKeyboardDock). */
  keyboardOffset?: number;
  /** While open the keyboard covers the nav bar, so the safe-area padding is dropped. */
  keyboardOpen?: boolean;
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

const useStyles = makeStyles((t) => ({
  bar: {
    minHeight: TOUCH,
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

function FormattingToolbarImpl(p: FormattingToolbarProps): ReactNode {
  const s = useStyles();
  const insets = useSafeAreaInsets();
  const tools = p.order.filter((id) => !p.hidden.includes(id));
  const { formatCollapsed: fc, addCollapsed: ac, onCollapse } = p;
  return (
    <View
      style={[
        s.bar,
        { paddingBottom: p.keyboardOpen ? 0 : insets.bottom, marginBottom: p.keyboardOffset ?? 0 },
      ]}
      testID="formatting-toolbar"
    >
      {fc ? (
        <>
          <ToolbarChevron
            half="format"
            mode="expand"
            onPress={() => onCollapse?.('format', false)}
          />
          <View style={s.scroll} />
        </>
      ) : (
        <>
          <ToolbarChevron
            half="format"
            mode="collapse"
            onPress={() => onCollapse?.('format', true)}
          />
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
        </>
      )}
      {ac ? (
        <ToolbarChevron half="add" mode="expand" onPress={() => onCollapse?.('add', false)} />
      ) : (
        <View style={s.pinned}>
          {tools
            .filter((id) => ADD_TOOLS.has(id))
            .map((id) => (
              <ToolButton key={id} id={id} {...p} />
            ))}
          <ToolbarChevron half="add" mode="collapse" onPress={() => onCollapse?.('add', true)} />
        </View>
      )}
    </View>
  );
}

export const FormattingToolbar = memo(FormattingToolbarImpl);

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

export { COLOR_PRESETS, ColorSwatchRow } from './ColorSwatchRow.tsx';
