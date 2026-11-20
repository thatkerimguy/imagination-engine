// Biometric unlock via expo-local-authentication (Face ID / fingerprint). Native only.
import * as LocalAuthentication from 'expo-local-authentication';

export async function biometricAvailable(): Promise<boolean> {
  try {
    return (
      (await LocalAuthentication.hasHardwareAsync()) &&
      (await LocalAuthentication.isEnrolledAsync())
    );
  } catch {
    return false;
  }
}

export async function authenticateBiometric(reason: string): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Use PIN',
      disableDeviceFallback: true,
    });
    return r.success;
  } catch {
    return false;
  }
}
