import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { IconButton } from '../../ui/IconButton.tsx';
import { TextField } from '../../ui/TextField.tsx';
import { space } from '../../ui/m3-tokens.ts';
import { tapFeedback } from '../../ui/haptics.ts';
import { parseNumberInput } from '../field-hints.ts';
import { snapNumber, stepNumber } from '../form-state.ts';

export interface NumberStepperProps {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  /** Compact variant: 32dp buttons and a narrower field (used per item in lists). */
  compact?: boolean;
  invalid?: boolean;
  testID?: string;
  onChange(value: number): void;
}

/** One unified stepper: [−] [editable value] [+]. Typed values commit on blur / submit. */
export function NumberStepper(p: NumberStepperProps): ReactNode {
  const [text, setText] = useState(String(p.value));
  useEffect(() => setText(String(p.value)), [p.value]);
  const size = p.compact ? 32 : 40;

  const commit = (): void => {
    const parsed = parseNumberInput(text);
    if (parsed === null) {
      setText(String(p.value));
      return;
    }
    const next = snapNumber(parsed, p.min, p.max, p.step);
    setText(String(next));
    p.onChange(next);
  };
  const go = (dir: 1 | -1): void => {
    tapFeedback();
    p.onChange(stepNumber(p.value, dir, p.min, p.max, p.step));
  };

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: p.compact ? space.xs : space.sm }}
    >
      <IconButton
        icon="remove"
        variant="tonal"
        size={size}
        accessibilityLabel={`Decrease ${p.label}`}
        disabled={p.value <= p.min}
        onPress={() => go(-1)}
      />
      <View style={{ width: p.compact ? 64 : 80 }}>
        <TextField
          dense
          testID={p.testID}
          accessibilityLabel={`${p.label} value`}
          value={text}
          onChangeText={setText}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectTextOnFocus
          textAlign="center"
          error={p.invalid ? '' : null}
        />
      </View>
      <IconButton
        icon="add"
        variant="tonal"
        size={size}
        accessibilityLabel={`Increase ${p.label}`}
        disabled={p.value >= p.max}
        onPress={() => go(1)}
      />
    </View>
  );
}
