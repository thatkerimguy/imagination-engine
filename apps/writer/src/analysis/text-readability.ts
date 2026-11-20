// Standard readability formulas from raw counts. All guard against empty input (0, not NaN).
export interface ReadabilityInput {
  words: number;
  sentences: number;
  syllables: number;
  complexWords: number;
  letters: number; // letters + digits
}

export interface Readability {
  fleschEase: number;
  fleschKincaid: number;
  gunningFog: number;
  smog: number;
  colemanLiau: number;
  ari: number;
}

export function readability(i: ReadabilityInput): Readability {
  const { words: w, sentences: s } = i;
  if (w === 0 || s === 0) {
    return { fleschEase: 0, fleschKincaid: 0, gunningFog: 0, smog: 0, colemanLiau: 0, ari: 0 };
  }
  const wps = w / s;
  const spw = i.syllables / w;
  return {
    fleschEase: 206.835 - 1.015 * wps - 84.6 * spw,
    fleschKincaid: 0.39 * wps + 11.8 * spw - 15.59,
    gunningFog: 0.4 * (wps + (100 * i.complexWords) / w),
    smog: 1.043 * Math.sqrt((i.complexWords * 30) / s) + 3.1291,
    colemanLiau: 0.0588 * ((i.letters / w) * 100) - 0.296 * ((s / w) * 100) - 15.8,
    ari: 4.71 * (i.letters / w) + 0.5 * wps - 21.43,
  };
}

export interface Consensus {
  grade: number;
  label: string;
}

/** Average US grade of Flesch–Kincaid, Fog, SMOG, Coleman–Liau and ARI, with a plain-language label. */
export function readabilityConsensus(m: Omit<Readability, 'fleschEase'>): Consensus {
  const grade = Math.max(0, (m.fleschKincaid + m.gunningFog + m.smog + m.colemanLiau + m.ari) / 5);
  const label =
    grade <= 6
      ? 'easy to read'
      : grade <= 9
        ? 'plain English'
        : grade <= 12
          ? 'fairly difficult'
          : grade <= 16
            ? 'difficult'
            : 'very difficult';
  return { grade, label };
}
