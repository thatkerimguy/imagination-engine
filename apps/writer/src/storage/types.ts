// The writer persists everything through this tiny key-value contract. Native builds back it with
// expo-sqlite; Expo Web (QA) and unit tests use localStorage / memory. Values are JSON strings.
export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  /** Every stored key starting with `prefix`, in ascending order. */
  keys(prefix: string): Promise<string[]>;
}
