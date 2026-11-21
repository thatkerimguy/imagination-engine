import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  save: vi.fn(),
  deleted: 0,
  pdfB64: 'JVBERi0xLjQ=',
  printToFile: vi.fn(async () => ({ uri: 'file:///cache/out.pdf' })),
}));
vi.mock('./save-file-native.ts', () => ({ saveFileNative: h.save }));
vi.mock('expo-print', () => ({ printToFileAsync: h.printToFile, printAsync: vi.fn() }));
vi.mock('expo-file-system', () => ({
  File: class {
    exists = true;
    base64 = async (): Promise<string> => h.pdfB64;
    delete = (): void => {
      h.deleted++;
    };
  },
}));

import { deliverBase64, deliverBytes, deliverText } from './deliver.ts';
import { exportPdf } from './pdf.ts';
import { shareJson } from './share-json.ts';
import { DEFAULT_EXPORT_OPTIONS, type CompiledBook } from './book-model.ts';

const decode = (b64: string): Uint8Array => new Uint8Array(Buffer.from(b64, 'base64'));
const sent = (): { name: string; mime: string; b64: string } => {
  const [name, mime, b64] = h.save.mock.calls.at(-1) as [string, string, string];
  return { name, mime, b64 };
};

beforeEach(() => {
  h.save.mockReset();
  h.deleted = 0;
});

describe('deliverText', () => {
  it('propagates saved and cancelled and sends decodable UTF-8', async () => {
    const text = 'Snake eyes — “held” ✦ 🎲';
    h.save.mockResolvedValueOnce('saved').mockResolvedValueOnce('cancelled');
    expect(await deliverText('a.md', text, 'text/markdown')).toBe('saved');
    expect(Buffer.from(sent().b64, 'base64').toString('utf8')).toBe(text);
    expect(sent().mime).toBe('text/markdown');
    expect(await deliverText('a.md', text, 'text/markdown')).toBe('cancelled');
  });

  it('round-trips text larger than 64 KB', async () => {
    const text = 'abc—'.repeat(40_000);
    h.save.mockResolvedValue('saved');
    await deliverText('big.txt', text, 'text/plain');
    expect(Buffer.from(sent().b64, 'base64').toString('utf8')).toBe(text);
  });
});

describe('deliverBytes', () => {
  it('propagates the result and round-trips a multi-MB payload', async () => {
    const bytes = new Uint8Array(3 * 1024 * 1024 + 5);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31) & 255;
    h.save.mockResolvedValueOnce('saved').mockResolvedValueOnce('cancelled');
    expect(await deliverBytes('b.zip', bytes, 'application/zip')).toBe('saved');
    expect(decode(sent().b64)).toEqual(bytes);
    expect(await deliverBytes('b.zip', bytes, 'application/zip')).toBe('cancelled');
  });

  it('round-trips a payload just over 64 KB', async () => {
    const bytes = Uint8Array.from({ length: 65_537 }, (_, i) => (i * 7) & 255);
    h.save.mockResolvedValue('saved');
    await deliverBytes('c.docx', bytes, 'application/zip');
    expect(decode(sent().b64)).toEqual(bytes);
  });
});

describe('deliverBase64', () => {
  it('passes base64 through untouched', async () => {
    h.save.mockResolvedValue('cancelled');
    expect(await deliverBase64('p.pdf', 'QUJD', 'application/pdf')).toBe('cancelled');
    expect(sent().b64).toBe('QUJD');
  });
});

describe('shareJson', () => {
  it('saves pretty JSON and propagates the result', async () => {
    h.save.mockResolvedValueOnce('saved').mockResolvedValueOnce('cancelled');
    expect(await shareJson('n.json', { a: 1 })).toBe('saved');
    expect(sent()).toMatchObject({ name: 'n.json', mime: 'application/json' });
    expect(Buffer.from(sent().b64, 'base64').toString('utf8')).toBe('{\n  "a": 1\n}\n');
    expect(await shareJson('n.json', {})).toBe('cancelled');
  });

  it('surfaces errors instead of falling back', async () => {
    h.save.mockRejectedValue(new Error('disk full'));
    await expect(shareJson('n.json', {})).rejects.toThrow('disk full');
  });
});

describe('exportPdf', () => {
  const book: CompiledBook = { title: 'Chrome Tide', author: '', sections: [] };

  it('saves the printed PDF base64 as-is and deletes the cached file', async () => {
    h.save.mockResolvedValueOnce('saved').mockResolvedValueOnce('cancelled');
    expect(await exportPdf(book, DEFAULT_EXPORT_OPTIONS)).toBe('saved');
    expect(sent()).toMatchObject({
      name: 'Chrome-Tide.pdf',
      mime: 'application/pdf',
      b64: h.pdfB64,
    });
    expect(h.deleted).toBe(1);
    expect(await exportPdf(book, DEFAULT_EXPORT_OPTIONS)).toBe('cancelled');
    expect(h.deleted).toBe(2);
  });

  it('still cleans up when saving fails', async () => {
    h.save.mockRejectedValue(new Error('nope'));
    await expect(exportPdf(book, DEFAULT_EXPORT_OPTIONS)).rejects.toThrow('nope');
    expect(h.deleted).toBe(1);
  });
});
