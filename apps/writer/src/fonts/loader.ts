// Native font loader: catalog faces load lazily; custom fonts are copied into app documents.
import * as DocumentPicker from 'expo-document-picker';
import * as Font from 'expo-font';
import { Directory, File, Paths } from 'expo-file-system';
import { ulid } from '@kn/core';
import type { NovelRepository } from '../store/repository.ts';
import { loadCustomFonts, saveCustomFonts, type CustomFont } from '../store/writer-prefs.ts';
import { addFont, findFont, removeFont } from './registry.ts';
import { displayNameFromFile, FontImportError, validateFontFile } from './validate.ts';

export { loadFontById, useFontFamily } from './shared.ts';

const PICK_TYPES = ['font/ttf', 'font/otf', 'application/x-font-ttf', 'application/octet-stream'];

/** Picks, validates, copies and registers a .ttf/.otf. Call from a press handler. Returns null if cancelled. */
export async function importCustomFont(repo: NovelRepository): Promise<CustomFont | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: PICK_TYPES,
    copyToCacheDirectory: true,
  });
  const asset = res.canceled ? undefined : res.assets[0];
  if (!asset) return null;
  try {
    const src = new File(asset.uri);
    const format = validateFontFile(asset.name, (await src.bytes()).subarray(0, 4));
    const dir = new Directory(Paths.document, 'fonts');
    dir.create({ idempotent: true, intermediates: true });
    const key = ulid();
    const dest = new File(dir, `${key}.${format}`);
    await src.copy(dest);
    const font: CustomFont = {
      id: `custom-font-${key}`,
      displayName: displayNameFromFile(asset.name),
      uri: dest.uri,
      format,
      addedAt: Date.now(),
    };
    await Font.loadAsync(font.id, font.uri);
    await saveCustomFonts(repo, addFont(await loadCustomFonts(repo), font));
    return font;
  } catch (e) {
    if (e instanceof FontImportError) throw e;
    throw new FontImportError('Could not import that font. Try another file.');
  }
}

/** Removes the file and registry entry. The caller must reset prefs.fontId if it was this font. */
export async function deleteCustomFont(repo: NovelRepository, id: string): Promise<void> {
  const list = await loadCustomFonts(repo);
  const font = findFont(list, id);
  if (font) {
    try {
      const file = new File(font.uri);
      if (file.exists) file.delete();
    } catch {
      /* file already gone */
    }
  }
  await saveCustomFonts(repo, removeFont(list, id));
}
