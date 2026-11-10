import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadHyphenators } from './hyphenation.ts';

const require = createRequire(import.meta.url);
const patternDir = join(dirname(require.resolve('hyphenopoly')), 'patterns');
const fromDisk = (file: string) => readFile(join(patternDir, file));
const show = (text: string) => text.replaceAll('\u00AD', '·');

describe('hyphenation', () => {
  it('breaks Turkish words at syllables', async () => {
    const { tr } = await loadHyphenators(fromDisk);
    expect(show(tr('Çekoslovakyalılaştıramadıklarımızdan'))).toBe(
      'Çe·kos·lo·vak·ya·lı·laş·tı·ra·ma·dık·la·rı·mız·dan',
    );
    expect(show(tr('İliklerine işleyen cinsten.'))).toBe('İlik·le·ri·ne iş·le·yen cins·ten.');
  });

  it('leaves short words alone and hyphenates English with English rules', async () => {
    const { en } = await loadHyphenators(fromDisk);
    expect(show(en('Rain. The kind that gets into your bones.'))).toBe(
      'Rain. The kind that gets into your bones.',
    );
    expect(show(en('extraordinary circumstances'))).toBe('ex·tra·or·di·nary cir·cum·stances');
  });
});
