// Master Lock settings: first-time PIN setup (with a one-time recovery code), then toggles,
// Change PIN, recovery-code reset and Lock now. All PIN logic lives in src/security/.
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { LockHome, type LockMode } from '../security/LockHome.tsx';
import { LockPrompt, failureMessage } from '../security/LockPrompt.tsx';
import {
  changePin,
  disableLock,
  isValidPin,
  normalizeRecovery,
  RECOVERY_LENGTH,
  setupPin,
  verifyRecovery,
} from '../security/lock.ts';
import { NewPinFlow } from '../security/NewPinFlow.tsx';
import { RecoveryCodeCard } from '../security/RecoveryCodeCard.tsx';
import { useLockConfig } from '../security/useLockConfig.ts';
import { useRepository } from '../store/context.tsx';
import { unlockSession } from '../store/unlock-session.ts';
import { ActionButton } from '../ui/ActionButton.tsx';
import { Field } from '../ui/Field.tsx';
import { Page } from '../ui/Page.tsx';
import { space } from '../ui/tokens.ts';
import { Txt } from '../ui/Txt.tsx';

export default function LockScreen(): ReactNode {
  const repo = useRepository();
  const { config } = useLockConfig();
  const [mode, setMode] = useState<LockMode>('home');
  /** Verified current PIN while changing it. */
  const [oldPin, setOldPin] = useState<string | null>(null);
  const [recovery, setRecovery] = useState('');
  const [codeReady, setCodeReady] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);
  if (config === undefined) return null;
  const home = (): void => {
    setMode('home');
    setOldPin(null);
    setCodeReady(false);
    setRecovery('');
  };

  let body: ReactNode;
  if (newCode) {
    body = <RecoveryCodeCard code={newCode} onDone={() => setNewCode(null)} />;
  } else if (!config) {
    body = (
      <NewPinFlow
        title="Choose a PIN"
        onSubmit={async (pin) => {
          const code = await setupPin(repo.docs, pin);
          unlockSession.setMasterUnlocked(true);
          setNewCode(code);
          repo.notifyChanged();
          return null;
        }}
      />
    );
  } else if (mode === 'disable') {
    body = (
      <LockPrompt
        config={config}
        title="Enter PIN"
        caption="Confirm to turn off Master Lock"
        allowBiometric={false}
        onUnlocked={() => {
          void disableLock(repo.docs).then(() => repo.notifyChanged());
          home();
        }}
      />
    );
  } else if (mode === 'change' && oldPin === null) {
    body = (
      <LockPrompt
        config={config}
        title="Current PIN"
        allowBiometric={false}
        onUnlocked={setOldPin}
      />
    );
  } else if (mode === 'change' && oldPin !== null) {
    body = (
      <NewPinFlow
        title="New PIN"
        onCancel={home}
        onSubmit={async (pin) => {
          if (!isValidPin(pin)) return 'PIN must be 4–6 digits.';
          const r = await changePin(repo.docs, oldPin, pin);
          if (!r.ok) return failureMessage(r);
          repo.notifyChanged();
          home();
          return null;
        }}
      />
    );
  } else if (mode === 'recover' && !codeReady) {
    const ok = normalizeRecovery(recovery).length === RECOVERY_LENGTH;
    body = (
      <View style={{ gap: space.md }}>
        <Field
          label="Recovery code"
          value={recovery}
          onChangeText={setRecovery}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="XXXX-XXXX-XXXX"
          error={recoveryError}
          hint="The 12-character code you saved when you set your PIN."
          testID="lock-recovery-input"
        />
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          <ActionButton label="Continue" disabled={!ok} onPress={() => setCodeReady(true)} />
          <ActionButton variant="ghost" quiet label="Cancel" onPress={home} />
        </View>
      </View>
    );
  } else if (mode === 'recover') {
    body = (
      <NewPinFlow
        title="New PIN"
        onCancel={home}
        onSubmit={async (pin) => {
          const r = await verifyRecovery(repo.docs, recovery, pin);
          if (!r.ok) {
            setCodeReady(false);
            setRecoveryError(
              r.reason === 'throttled' ? failureMessage(r) : 'That recovery code didn’t match.',
            );
            return null;
          }
          unlockSession.setMasterUnlocked(true);
          setNewCode(r.recoveryCode ?? null);
          repo.notifyChanged();
          home();
          return null;
        }}
      />
    );
  } else {
    body = <LockHome config={config} onMode={setMode} />;
  }

  return (
    <Page>
      {!config && !newCode ? (
        <Txt variant="body" color="inkSecondary">
          A PIN keeps your writing private on this device. You will get a one-time recovery code.
        </Txt>
      ) : null}
      {body}
    </Page>
  );
}
