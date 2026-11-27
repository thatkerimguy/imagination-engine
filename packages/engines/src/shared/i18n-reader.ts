// Tiny reader-side string table for engine ARIA labels and control prompts (en / tr / es).
// Author text is never translated; only the engines' own chrome. The locale comes from
// `<html lang>` (the reader sets it from the book / browser), falling back to English.

const EN = {
  lookAgain: 'Look again',
  revealRedacted: 'Reveal redacted text',
  breakSeal: 'Break the seal',
  holdToScan: 'Hold to scan',
  openNote: 'Open note',
  closeNote: 'Close note',
  replayEffect: 'Replay effect',
  holdToListen: 'Hold to listen',
  ambientSound: 'Ambient sound',
  soundCue: 'Sound cue',
  visualEffect: 'Visual effect',
  rollDice: 'Roll the dice',
  strikeLighter: 'Strike the lighter',
  soundOff: 'sound off',
  fadingOut: 'fading out',
} as const;

export type ReaderStringKey = keyof typeof EN;
type Table = Record<ReaderStringKey, string>;

const TR: Table = {
  lookAgain: 'Tekrar bak',
  revealRedacted: 'Karartılmış metni göster',
  breakSeal: 'Mührü kır',
  holdToScan: 'Taramak için basılı tut',
  openNote: 'Notu aç',
  closeNote: 'Notu kapat',
  replayEffect: 'Efekti yeniden oynat',
  holdToListen: 'Dinlemek için basılı tut',
  ambientSound: 'Ortam sesi',
  soundCue: 'Ses işareti',
  visualEffect: 'Görsel efekt',
  rollDice: 'Zarları at',
  strikeLighter: 'Çakmağı yak',
  soundOff: 'ses kapalı',
  fadingOut: 'kısılıyor',
};

const ES: Table = {
  lookAgain: 'Mirar otra vez',
  revealRedacted: 'Revelar el texto censurado',
  breakSeal: 'Romper el sello',
  holdToScan: 'Mantén pulsado para escanear',
  openNote: 'Abrir nota',
  closeNote: 'Cerrar nota',
  replayEffect: 'Repetir efecto',
  holdToListen: 'Mantén pulsado para escuchar',
  ambientSound: 'Sonido ambiental',
  soundCue: 'Efecto de sonido',
  visualEffect: 'Efecto visual',
  rollDice: 'Lanzar los dados',
  strikeLighter: 'Encender el mechero',
  soundOff: 'sonido apagado',
  fadingOut: 'desvaneciéndose',
};

const TABLES: Record<string, Table> = { en: EN, tr: TR, es: ES };

/** Primary subtag of `<html lang>` (or `lang`), e.g. "tr-TR" → "tr"; unknown → "en". */
export function readerLocale(lang?: string): 'en' | 'tr' | 'es' {
  const raw = lang ?? (typeof document === 'undefined' ? '' : document.documentElement.lang);
  const code = raw.toLowerCase().split(/[-_]/)[0] ?? '';
  return code === 'tr' || code === 'es' ? code : 'en';
}

/** Engine chrome string in the reader's locale. */
export function rt(key: ReaderStringKey, lang?: string): string {
  return (TABLES[readerLocale(lang)] ?? EN)[key];
}
