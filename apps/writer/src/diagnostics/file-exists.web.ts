// Web has no device files: file:// URIs cannot be checked, so they are assumed present.
export const fileExists = (): Promise<boolean> => Promise.resolve(true);
