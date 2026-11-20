// Folio PIN keypad: hairline-ring dots that fill with the accent, a borderless typographic 3×4
// keypad (large tabular digits, Press wash only), delete and optional biometric keys, a quiet
// error caption and a short shake on a wrong PIN. The parent owns verification and the PIN length.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, View } from 'react-native';
import { Glyph } from '../ui/Glyph.tsx';
import { tapFeedback } from '../ui/haptics.ts';
import { Press } from '../ui/Press.tsx';
import { space } from '../ui/tokens.ts';
import { makeStyles, useTheme } from '../ui/theme.tsx';
import { Txt } from '../ui/Txt.tsx';
import { tabular } from '../ui/type.ts';

export interface PinPadProps {
  length: number;
  title: string;
  /** Quiet supporting line under the title. */
  caption?: string;
  /** Quiet error line; changing `errorKey` replays the shake. */
  error?: string | null;
  errorKey?: number;
  /** Called with the full PIN once `length` digits are entered; the pad then clears itself. */
  onComplete(pin: string): void;
  /** Shows a biometric key beside 0 when set. */
  onBiometric?: () => void;
  disabled?: boolean;
}

const ROWS: readonly (readonly string[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['bio', '0', 'del'],
];

export function PinPad(p: PinPadProps): ReactNode {
  const { colors } = useTheme();
  const s = useStyles();
  const [pin, setPin] = useState('');
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!p.errorKey) return;
    Animated.sequence(
      [8, -8, 6, -6, 0].map((toValue) =>
        Animated.timing(shake, { toValue, duration: 50, useNativeDriver: true }),
      ),
    ).start();
  }, [p.errorKey, shake]);
  useEffect(() => setPin(''), [p.length]);

  const press = (key: string): void => {
    if (p.disabled) return;
    tapFeedback();
    if (key === 'del') return setPin((v) => v.slice(0, -1));
    if (key === 'bio') return p.onBiometric?.();
    const next = (pin + key).slice(0, p.length);
    if (next.length < p.length) return setPin(next);
    setPin('');
    p.onComplete(next);
  };

  return (
    <View style={s.root} testID="lock-pinpad">
      <Txt variant="title" style={s.center}>
        {p.title}
      </Txt>
      <Txt variant="meta" color={p.error ? 'danger' : 'inkSecondary'} style={s.caption}>
        {p.error ?? p.caption ?? ' '}
      </Txt>
      <Animated.View style={[s.dots, { transform: [{ translateX: shake }] }]}>
        {Array.from({ length: p.length }, (_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              i < pin.length
                ? { backgroundColor: colors.accent, borderColor: colors.accent }
                : { borderColor: colors.borderStrong },
            ]}
          />
        ))}
      </Animated.View>
      <View style={s.pad}>
        {ROWS.map((row) => (
          <View key={row.join()} style={s.row}>
            {row.map((key) => {
              if (key === 'bio' && !p.onBiometric) return <View key={key} style={s.key} />;
              const label = key === 'del' ? 'Delete' : key === 'bio' ? 'Use biometrics' : key;
              return (
                <Press
                  key={key}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  disabled={p.disabled}
                  onPress={() => press(key)}
                  testID={`pin-key-${key}`}
                  style={s.key}
                >
                  {key === 'del' ? (
                    <Glyph name="delete" size={22} />
                  ) : key === 'bio' ? (
                    <Glyph name="unlock" size={22} color="accent" />
                  ) : (
                    <Txt style={s.digit}>{key}</Txt>
                  )}
                </Press>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  root: { alignItems: 'center', gap: space.sm },
  center: { textAlign: 'center' },
  caption: { textAlign: 'center', minHeight: 18 },
  dots: { flexDirection: 'row', gap: space.md, marginVertical: space.lg },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  pad: { gap: space.xs, marginTop: space.sm },
  row: { flexDirection: 'row', gap: space.lg },
  key: {
    width: 76,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: { ...tabular, fontSize: 30, lineHeight: 36, fontWeight: '300' },
}));
