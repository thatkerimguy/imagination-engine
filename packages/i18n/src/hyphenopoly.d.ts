// Hyphenopoly 6 ships no types. Only the module API used by hyphenation.ts is described.
declare module 'hyphenopoly' {
  export interface HyphenopolyConfig {
    /** Pattern names, e.g. `tr`, `en-us`. */
    readonly require: readonly string[];
    /** Inserted at break points; defaults to a soft hyphen. */
    readonly hyphen?: string;
    readonly minWordLength?: number;
    /** Fetches a pattern file such as `tr.wasm`. */
    readonly loader: (file: string, patternDir: URL) => Promise<ArrayBuffer | Uint8Array>;
  }

  const hyphenopoly: {
    config(options: HyphenopolyConfig): Map<string, Promise<(text: string) => string>>;
  };
  export default hyphenopoly;
}
