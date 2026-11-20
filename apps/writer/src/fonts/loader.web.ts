// Web font loader: custom fonts are stored inline as data URIs (<= 2 MB) in the registry.
import * as DocumentPicker from 'expo-document-picker';
import * as Font from 'expo-font';
import { ulid } from '@kn/core';
import type { NovelRepository } from '../store/repository.ts';
import { loadCustomFonts, saveCustomFonts, type CustomFont } from '../store/writer-prefs.ts';
import { addFont, removeFont } from './registry.ts';
import {
  checkFontSize,
  displayNameFromFile,
  FontImportError,
  validateFontFile,
} from './validate.ts';

export { loadFontById, useFontFamily } from './shared.ts';

const PICK_TYPES = ['font/ttf', 'font/otf', 'application/x-font-ttf', 'application/octet-stream'];

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** Picks, validates and registers a .ttf/.otf as a data URI. Call from a press handler. Null if cancelled. */
export async function importCustomFont(repo: NovelRepository): Promise<CustomFont | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: PICK_TYPES,
    copyToCacheDirectory: true,
  });
  const asset = res.canceled ? undefined : res.assets[0];
  if (!asset) return null;
  try {
    const buf = asset.file
      ? await asset.file.arrayBuffer()
      : await (await fetch(asset.uri)).arrayBuffer();
    const bytes = new Uint8Array(buf);
    const tooBig = checkFontSize(bytes);
    if (tooBig) throw new FontImportError(tooBig);
    const format = validateFontFile(asset.name, bytes);
    const font: CustomFont = {
      id: `custom-font-${ulid()}`,
      displayName: displayNameFromFile(asset.name),
      uri: `data:font/${format};base64,${toBase64(bytes)}`,
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

/** Removes the registry entry. The caller must reset prefs.fontId if it was this font. */
export async function deleteCustomFont(repo: NovelRepository, id: string): Promise<void> {
  await saveCustomFonts(repo, removeFont(await loadCustomFonts(repo), id));
}
