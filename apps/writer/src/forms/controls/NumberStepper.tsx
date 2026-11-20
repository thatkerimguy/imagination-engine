import type { ReactNode } from 'react';
import { Stepper } from '../../ui/Stepper.tsx';
import { snapNumber } from '../form-state.ts';

export interface NumberStepperProps {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  /** Compact variant: 36dp capsule (used per item in lists). */
  compact?: boolean;
  invalid?: boolean;
  /** Muted range caption under the capsule. */
  caption?: string;
  testID?: string;
  onChange(value: number): void;
}

/** Folio capsule stepper; every committed value is snapped to the field's min/max/step grid. */
export function NumberStepper(p: NumberStepperProps): ReactNode {
  return (
    <Stepper
      value={p.value}
      min={p.min}
      max={p.max}
      step={p.step}
      label={p.label}
      compact={p.compact}
      invalid={p.invalid}
      caption={p.caption}
      testID={p.testID}
      onChange={(v) => p.onChange(snapNumber(v, p.min, p.max, p.step))}
    />
  );
}
