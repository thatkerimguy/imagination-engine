// Web has no biometric unlock; the UI hides the option.
export const biometricAvailable = (): Promise<boolean> => Promise.resolve(false);
export const authenticateBiometric = (): Promise<boolean> => Promise.resolve(false);
