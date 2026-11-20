// Typography controls of the Appearance screen: size and line-height steppers, margin and
// alignment segments, first-line indent, and the Samsung keyboard safe-mode toggle.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import {
  FONT_SIZE_RANGE,
  LINE_HEIGHT_RANGE,
  type MarginPreset,
  type TextAlign,
} from '../store/writer-prefs.ts';
import { ListRow } from '../ui/Page.tsx';
import { SegmentControl, type SegmentOption } from '../ui/SegmentControl.tsx';
import { Stepper } from '../ui/Stepper.tsx';
import { Toggle } from '../ui/Toggle.tsx';
import { space } from '../ui/tokens.ts';
import { Txt } from '../ui/Txt.tsx';
import { useWriterPrefs } from '../ui/theme.tsx';

const MARGINS: readonly SegmentOption<MarginPreset>[] = [
  { value: 'compact', label: 'Tight' },
  { value: 'comfortable', label: 'Medium' },
  { value: 'wide', label: 'Wide' },
];
const ALIGNS: readonly SegmentOption<TextAlign>[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

const oneDecimal = (v: number): string => v.toFixed(1);

function StepRow(p: { label: string; children: ReactNode }): ReactNode {
  return (
    <View
      style={{
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Txt variant="body">{p.label}</Txt>
      {p.children}
    </View>
  );
}

function SegmentRow(p: { label: string; children: ReactNode }): ReactNode {
  return (
    <View style={{ gap: space.xs, paddingVertical: space.xs }}>
      <Txt variant="body">{p.label}</Txt>
      {p.children}
    </View>
  );
}

export function TypographyControls(): ReactNode {
  const [p, update] = useWriterPrefs();
  return (
    <View>
      <StepRow label="Font size">
        <Stepper
          label="font size"
          testID="font-size"
          value={p.fontSize}
          min={FONT_SIZE_RANGE.min}
          max={FONT_SIZE_RANGE.max}
          step={1}
          onChange={(fontSize) => update({ fontSize })}
        />
      </StepRow>
      <StepRow label="Line height">
        <Stepper
          label="line height"
          testID="line-height"
          value={p.lineHeight}
          min={LINE_HEIGHT_RANGE.min}
          max={LINE_HEIGHT_RANGE.max}
          step={0.1}
          format={oneDecimal}
          onChange={(lineHeight) => update({ lineHeight })}
        />
      </StepRow>
      <SegmentRow label="Margins">
        <SegmentControl<MarginPreset>
          accessibilityLabel="Margins"
          testID="margins"
          options={MARGINS}
          value={p.marginPreset}
          onChange={(marginPreset) => update({ marginPreset })}
        />
      </SegmentRow>
      <SegmentRow label="Alignment">
        <SegmentControl<TextAlign>
          accessibilityLabel="Default alignment"
          testID="align"
          options={ALIGNS}
          value={p.defaultAlign}
          onChange={(defaultAlign) => update({ defaultAlign })}
        />
      </SegmentRow>
      <ListRow
        title="First-line indent"
        trailing={
          <Toggle
            testID="first-line-indent"
            accessibilityLabel="First-line indent"
            value={p.firstLineIndent}
            onValueChange={(firstLineIndent) => update({ firstLineIndent })}
          />
        }
      />
      <ListRow
        last
        title="Samsung IME safe mode"
        subtitle="Turns off autocorrect and spellcheck so Samsung Keyboard stops duplicating text."
        trailing={
          <Toggle
            testID="samsung-safe-ime"
            accessibilityLabel="Samsung IME safe mode"
            value={p.samsungSafeIme}
            onValueChange={(samsungSafeIme) => update({ samsungSafeIme })}
          />
        }
      />
    </View>
  );
}
