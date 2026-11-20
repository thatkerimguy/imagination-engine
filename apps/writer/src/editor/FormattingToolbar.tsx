// Scrollable M3 formatting bar. Buttons act on press-in and refuse focus so the keyboard and the
// TextInput selection survive a tap.
import type { ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import type { ToolId } from '../store/writer-prefs.ts';
import { AppText } from '../ui/AppText.tsx';
import { Icon, type IconName } from '../ui/Icon.tsx';
import { shape, space, TOUCH } from '../ui/m3-tokens.ts';
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

type Face = { icon: IconName } | { text: string } | { icon: IconName; text: string };

const FACES: Readonly<Record<ToolId, Face>> = {
  tab: { icon: 'keyboard-tab' },
  bold: { icon: 'format-bold' },
  italic: { icon: 'format-italic' },
  underline: { icon: 'format-underlined' },
  strike: { icon: 'strikethrough-s' },
  highlight: { icon: 'border-color' },
  h1: { text: 'H1' },
  h2: { text: 'H2' },
  h3: { text: 'H3' },
  align: { icon: 'format-align-left' },
  quote: { icon: 'format-quote' },
  bullet: { icon: 'format-list-bulleted' },
  fgColor: { icon: 'format-color-text' },
  bgColor: { icon: 'format-color-fill' },
  comment: { icon: 'add-comment' },
  separator: { icon: 'horizontal-rule' },
  addProse: { icon: 'add', text: 'Prose' },
  addDialogue: { icon: 'add', text: 'Dialogue' },
  addScene: { icon: 'add', text: 'Scene' },
  addGimmick: { icon: 'add', text: 'Gimmick' },
};

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
  bar: { backgroundColor: t.m3.surfaceContainer },
  content: { paddingHorizontal: space.xs, alignItems: 'center' },
  btn: {
    minWidth: TOUCH,
    height: TOUCH,
    borderRadius: shape.full,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  on: { backgroundColor: t.m3.secondaryContainer },
  pressed: { backgroundColor: t.m3.surfaceContainerHighest },
  off: { opacity: 0.38 },
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
        contentContainerStyle={s.content}
      >
        {tools.map((id) => (
          <ToolButton key={id} id={id} {...p} />
        ))}
      </ScrollView>
    </View>
  );
}

function ToolButton(p: FormattingToolbarProps & { id: ToolId }): ReactNode {
  const s = useStyles();
  const { id } = p;
  const face = FACES[id];
  const icon: IconName | undefined =
    id === 'align' ? `format-align-${p.align}` : 'icon' in face ? face.icon : undefined;
  const on = !!p.active[id];
  const disabled = !!p.disabledText && TEXT_TOOLS.has(id);
  const color = on ? 'onSecondaryContainer' : 'onSurfaceVariant';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={LABELS[id]}
      accessibilityState={{ selected: on, disabled }}
      disabled={disabled}
      focusable={false}
      onPress={() => p.onTool(id)}
      testID={`tool-${id}`}
      style={({ pressed }) => [s.btn, on && s.on, pressed && s.pressed, disabled && s.off]}
    >
      {icon ? <Icon name={icon} size={22} color={color} /> : null}
      {'text' in face ? (
        <AppText variant="labelLarge" color={color}>
          {face.text}
        </AppText>
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
