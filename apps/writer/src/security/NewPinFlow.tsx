// Choose-and-confirm a new 4–6 digit PIN. The parent decides what "done" means (setup, change,
// recovery reset) in `onSubmit`, which returns an error message or null on success.
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { ActionButton } from '../ui/ActionButton.tsx';
import { SegmentControl, type SegmentOption } from '../ui/SegmentControl.tsx';
import { space } from '../ui/tokens.ts';
import { PinPad } from './PinPad.tsx';
import { PRIVACY_TAG } from './screen-privacy.ts';
import { useScreenPrivacy } from './use-screen-privacy.ts';

type Len = '4' | '5' | '6';
const LENGTHS: readonly SegmentOption<Len>[] = [
  { value: '4', label: '4 digits', testID: 'pin-length-4' },
  { value: '5', label: '5 digits', testID: 'pin-length-5' },
  { value: '6', label: '6 digits', testID: 'pin-length-6' },
];

export interface NewPinFlowProps {
  title?: string;
  onSubmit(pin: string): Promise<string | null>;
  onCancel?: () => void;
}

export function NewPinFlow(p: NewPinFlowProps): ReactNode {
  useScreenPrivacy(PRIVACY_TAG.pin);
  const [len, setLen] = useState<Len>('4');
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const fail = (msg: string): void => {
    setError(msg);
    setErrorKey((k) => k + 1);
  };
  const done = async (pin: string): Promise<void> => {
    if (first === null) {
      setError(null);
      return setFirst(pin);
    }
    if (pin !== first) {
      setFirst(null);
      return fail('PINs didn’t match. Start again.');
    }
    const msg = await p.onSubmit(pin);
    if (msg) {
      setFirst(null);
      fail(msg);
    }
  };
  return (
    <View style={{ gap: space.md, alignItems: 'center' }}>
      {first === null ? (
        <SegmentControl<Len>
          options={LENGTHS}
          value={len}
          onChange={setLen}
          accessibilityLabel="PIN length"
          style={{ alignSelf: 'stretch' }}
        />
      ) : null}
      <PinPad
        length={Number(len)}
        title={first === null ? (p.title ?? 'Choose a PIN') : 'Confirm PIN'}
        caption={first === null ? 'Use 4 to 6 digits' : 'Enter it once more'}
        error={error}
        errorKey={errorKey}
        onComplete={(pin) => void done(pin)}
      />
      {p.onCancel ? (
        <ActionButton variant="ghost" quiet label="Cancel" onPress={p.onCancel} />
      ) : null}
    </View>
  );
}
