// Expo Web (QA): browsers have no FLAG_SECURE; screen privacy is a silent no-op.
export const preventCapture = (): void => undefined;
export const allowCapture = (): void => undefined;
