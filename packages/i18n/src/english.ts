/** Words whose spelling and sound disagree at the start (an hour, a unicorn). */
const SILENT_H = /^(hour|honest|honou?r|heir|herb)/i;
const YOU_SOUND = /^(uni(?!nt|mp|nd|nf|nh|ns|nst)|use|usu|uti|ura|uro|eu|ewe|one|once|ubiq|uk)/i;
/** Letters whose spoken names start with a vowel sound (an FBI agent, an MRI, but a UFO). */
const VOWEL_SOUND_LETTERS = new Set(['a', 'e', 'f', 'h', 'i', 'l', 'm', 'n', 'o', 'r', 's', 'x']);

/** "a" or "an" for the word that follows, by sound rather than spelling. */
export function indefiniteArticle(word: string): 'a' | 'an' {
  const trimmed = word.trim();
  const first = trimmed.charAt(0);
  if (first === '') return 'a';
  if (/^\d/.test(trimmed)) return /^(8|11|18)(\D|$)|^8\d*/.test(trimmed) ? 'an' : 'a';
  const isAcronym =
    trimmed.length > 1 && /^[A-Z]{2,}\b/.test(trimmed) && !/^[A-Z][a-z]/.test(trimmed);
  if (isAcronym && !/^(NASA|NATO|UNESCO|OPEC)/.test(trimmed)) {
    return VOWEL_SOUND_LETTERS.has(first.toLowerCase()) ? 'an' : 'a';
  }
  if (SILENT_H.test(trimmed)) return 'an';
  if (YOU_SOUND.test(trimmed)) return 'a';
  return /^[aeiou]/i.test(trimmed) ? 'an' : 'a';
}

/** Prefixes the article: "an apple", "a unicorn". */
export function withArticle(word: string): string {
  return `${indefiniteArticle(word)} ${word}`;
}
