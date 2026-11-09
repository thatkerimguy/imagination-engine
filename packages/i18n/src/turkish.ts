/**
 * Turkish suffixes after inserted words. An author writes `{name}'e` once; the engine rewrites the
 * suffix for the actual value: Kerim'e, Ayşe'ye, Can'a, Ahmet'e, 6'ya, TDK'ya.
 *
 * It works letter by letter on whatever suffix was written, so every case ending and most chains
 * (`'deki`, `'ınki`, `'dır`, `'ler`) are covered without a table per suffix:
 * buffer letters (y/n/s) appear only after a vowel, d/c harden to t/ç after a voiceless consonant,
 * and each vowel follows 2-way (e/a) or 4-way (i/ı/u/ü) harmony from the vowel before it.
 */

const VOWELS = new Set(['a', 'e', 'ı', 'i', 'o', 'ö', 'u', 'ü']);
const FRONT = new Set(['e', 'i', 'ö', 'ü']);
const ROUNDED = new Set(['o', 'ö', 'u', 'ü']);
/** "Fıstıkçı şahap": a suffix's d becomes t, and c becomes ç, after these. */
const VOICELESS = new Set(['f', 's', 't', 'k', 'ç', 'ş', 'h', 'p']);

/** How letters are read in acronyms (TDK'ya, TRT'ye, THY'ye). */
const LETTER_NAMES: Readonly<Record<string, string>> = {
  a: 'a',
  b: 'be',
  c: 'ce',
  ç: 'çe',
  d: 'de',
  e: 'e',
  f: 'fe',
  g: 'ge',
  ğ: 'yumuşak ge',
  h: 'he',
  ı: 'ı',
  i: 'i',
  j: 'je',
  k: 'ka',
  l: 'le',
  m: 'me',
  n: 'ne',
  o: 'o',
  ö: 'ö',
  p: 'pe',
  q: 'kü',
  r: 're',
  s: 'se',
  ş: 'şe',
  t: 'te',
  u: 'u',
  ü: 'ü',
  v: 've',
  w: 'çift ve',
  x: 'iks',
  y: 'ye',
  z: 'ze',
};

const ONES = ['sıfır', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const TENS = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];
const SCALES = ['', 'bin', 'milyon', 'milyar', 'trilyon', 'katrilyon', 'kentilyon'];

export interface TurkishSuffixHints {
  /**
   * Treat the word as if it were spelled this way, for words that break harmony: Kemal → "Kemel"
   * gives Kemal'e; saat → "saet" gives saat'i.
   */
  readonly suffixAs?: string;
}

function lowerTr(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replaceAll('â', 'a')
    .replaceAll('î', 'i')
    .replaceAll('û', 'u');
}

/** The last word Turkish speakers say when reading a whole number aloud (3 → üç, 3500 → yüz). */
function lastIntegerWord(digits: string): string {
  const s = digits.replace(/^0+/, '');
  if (s === '') return ONES[0] ?? 'sıfır';
  let group = 0;
  let end = s.length;
  while (end > 0) {
    const chunk = s.slice(Math.max(0, end - 3), end).padStart(3, '0');
    if (chunk !== '000') {
      if (group > 0) return SCALES[group] ?? 'kentilyon';
      const [h, t, o] = [...chunk].map(Number) as [number, number, number];
      if (o) return ONES[o] ?? '';
      if (t) return TENS[t] ?? '';
      if (h) return 'yüz';
    }
    end -= 3;
    group += 1;
  }
  return ONES[0] ?? 'sıfır';
}

/** Reading of a number, by its last spoken word: 2,5 → "beş" (iki virgül beş), -40 → "kırk". */
export function turkishNumberReading(value: number | string): string {
  const text = typeof value === 'number' ? String(Math.abs(value)) : value.replace(/^[-+%]/, '');
  // "1.000" in Turkish text groups thousands; a lone separator before 1–2 digits is a decimal mark.
  const grouped = /^\d{1,3}(\.\d{3})+$/.test(text);
  const [whole = '0', fraction] = grouped ? [text.replaceAll('.', '')] : text.split(/[.,]/);
  const decimals = fraction?.replace(/0+$/, '');
  return decimals ? lastIntegerWord(decimals) : lastIntegerWord(whole);
}

/** What the suffix engine "hears" for a value: numbers and acronyms by how they are read aloud. */
export function turkishReading(value: string | number): string {
  if (typeof value === 'number') return turkishNumberReading(value);
  const token = value.trim().split(/\s+/).pop() ?? '';
  const bare = token.replace(/[^\p{L}\p{N}.,%+-]/gu, '').replace(/[.,]+$/, '');
  if (/^[-+%]?\d+([.,]\d+)*%?$/.test(bare)) return turkishNumberReading(bare.replace(/%$/, ''));
  const letters = bare.replace(/[^\p{L}]/gu, '');
  const lowered = lowerTr(letters);
  const isAcronym =
    letters.length >= 2 &&
    letters === letters.toLocaleUpperCase('tr-TR') &&
    ![...lowered].some((c) => VOWELS.has(c));
  if (isAcronym) {
    const last = [...lowered].pop() ?? '';
    return LETTER_NAMES[last] ?? lowered;
  }
  return lowered;
}

interface Sound {
  readonly lastVowel: string;
  readonly endsWithVowel: boolean;
  readonly endsVoiceless: boolean;
}

function analyze(reading: string): Sound {
  const letters = [...lowerTr(reading)].filter((c) => /\p{L}/u.test(c));
  const lastLetter = letters.at(-1) ?? '';
  const lastVowel = letters.findLast((c) => VOWELS.has(c)) ?? 'e';
  return {
    lastVowel,
    endsWithVowel: VOWELS.has(lastLetter),
    endsVoiceless: VOICELESS.has(lastLetter),
  };
}

function harmonizeVowel(vowel: string, previous: string): string {
  const front = FRONT.has(previous);
  if (vowel === 'e' || vowel === 'a') return front ? 'e' : 'a';
  if (vowel === 'i' || vowel === 'ı' || vowel === 'u' || vowel === 'ü') {
    const rounded = ROUNDED.has(previous);
    if (front) return rounded ? 'ü' : 'i';
    return rounded ? 'u' : 'ı';
  }
  return vowel; // o/ö appear only in fixed suffixes such as -yor
}

/** Endings that never change: -ki (Can'daki) and -ken (Ayşe'yken). */
const INVARIANT_TAIL = /(ki|ken)$/;

/**
 * Rewrites a suffix (without the apostrophe) for a value. The suffix may be written in any of its
 * forms: `e`, `a`, `ye` and `ya` all mean the dative.
 */
export function harmonizeSuffix(
  value: string | number,
  suffix: string,
  hints: TurkishSuffixHints = {},
): string {
  if (suffix === '') return '';
  const shouted = suffix === suffix.toLocaleUpperCase('tr-TR') && suffix !== lowerTr(suffix);
  const sound = analyze(hints.suffixAs ?? turkishReading(value));
  const s = lowerTr(suffix);

  // Instrumental -(y)lA is the one suffix whose buffer comes before a consonant.
  if (/^y?l[ea]$/.test(s)) {
    const out = (sound.endsWithVowel ? 'y' : '') + 'l' + harmonizeVowel('e', sound.lastVowel);
    return shouted ? out.toLocaleUpperCase('tr-TR') : out;
  }

  let buffer = '';
  let rest = s;
  if (/^y[aeıioöuü]/.test(s) || /^n[ıiuü]n/.test(s) || /^s[ıiuü](n.*)?$/.test(s)) {
    buffer = s.charAt(0);
    rest = s.slice(1);
  } else if (VOWELS.has(s.charAt(0))) {
    buffer = /^[ıiuü]n/.test(s) ? 'n' : 'y'; // genitive -(n)In, otherwise -(y)
  }

  let head = rest;
  let tail = '';
  const invariant = INVARIANT_TAIL.exec(rest);
  if (invariant && invariant.index > 0) {
    head = rest.slice(0, invariant.index);
    tail = invariant[0];
  } else if (invariant && invariant.index === 0) {
    head = '';
    tail = rest;
  }

  const chars = [...head];
  const first = chars[0];
  if (!buffer && first !== undefined) {
    if (first === 'd' || first === 't') chars[0] = sound.endsVoiceless ? 't' : 'd';
    else if (first === 'c' || first === 'ç') chars[0] = sound.endsVoiceless ? 'ç' : 'c';
  }

  let previous = sound.lastVowel;
  const harmonized = chars.map((c) => {
    if (!VOWELS.has(c)) return c;
    const next = harmonizeVowel(c, previous);
    previous = next;
    return next;
  });

  const out = (sound.endsWithVowel ? buffer : '') + harmonized.join('') + tail;
  return shouted ? out.toLocaleUpperCase('tr-TR') : out;
}
