// `@kn/engines/shared`: primitives engines build on. Host-only pieces (ornament layers, surface
// tiles, stingers) reach engines through EngineRuntimeContext, so engine chunks stay lean.
export * from './dom-safe.ts';
export * from './kit.ts';
export { readerLocale, rt, type ReaderStringKey } from './i18n-reader.ts';
export { createOrnamentLayer } from './ornaments.ts';
export { surfaceTile } from './surface-tiles.ts';
