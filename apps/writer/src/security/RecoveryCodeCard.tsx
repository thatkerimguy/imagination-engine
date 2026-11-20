// Shows the one-time recovery code in a large mono block with Copy/Share and an acknowledgement.
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { ActionButton } from '../ui/ActionButton.tsx';
import { radius, space } from '../ui/tokens.ts';
import { makeStyles } from '../ui/theme.tsx';
import { Txt } from '../ui/Txt.tsx';
import { mono } from '../ui/type.ts';
import { shareText } from './share-text.ts';

/** `ABCD-EFGH-JKLM` for reading aloud / copying by eye. */
export const groupCode = (code: string): string => code.replace(/(.{4})(?=.)/g, '$1-');

export function RecoveryCodeCard(p: { code: string; onDone(): void }): ReactNode {
  const s = useStyles();
  const [shared, setShared] = useState(false);
  return (
    <View style={s.root}>
      <Txt variant="title">Your recovery code</Txt>
      <Txt variant="body" color="inkSecondary">
        If you forget your PIN, this code is the only way back in. It is shown once and stored only
        as a hash. Write it down or save it somewhere safe.
      </Txt>
      <View style={s.block}>
        <Txt style={s.code} selectable testID="lock-recovery-code">
          {groupCode(p.code)}
        </Txt>
      </View>
      <View style={s.row}>
        <ActionButton
          variant="secondary"
          icon="share"
          label={shared ? 'Shared' : 'Copy / Share'}
          onPress={() => void shareText(groupCode(p.code), 'Recovery code').then(setShared)}
          testID="lock-recovery-share"
        />
        <ActionButton label="I’ve saved it" onPress={p.onDone} testID="lock-recovery-done" />
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { gap: space.md },
  block: {
    paddingVertical: space.lg,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.hairline,
  },
  code: { fontFamily: mono, fontSize: 24, letterSpacing: 2, color: t.colors.ink },
  row: { flexDirection: 'row', gap: space.xs },
}));
