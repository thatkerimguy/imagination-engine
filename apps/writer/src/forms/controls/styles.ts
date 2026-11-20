import { StyleSheet } from 'react-native';
import { colors, radius, space, TAP } from '../../ui/theme.ts';

export const controlStyles = StyleSheet.create({
  stack: { gap: space.sm },
  input: {
    minHeight: TAP,
    color: colors.fg,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: 16,
  },
  invalid: { borderColor: colors.danger },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  counter: { color: colors.muted, fontSize: 12, alignSelf: 'flex-end' },
  help: { color: colors.muted, fontSize: 12 },
  roundBtn: {
    width: TAP,
    height: TAP,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundBtnText: { color: colors.fg, fontSize: 20, fontWeight: '600' },
  disabled: { opacity: 0.35 },
});
