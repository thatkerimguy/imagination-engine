// Reads the Android 12+ wallpaper palette from the local MaterialYou native module (written by
// plugins/with-android-polish.js). Null on web, iOS, Expo Go, Android < 12 or any OEM gap.
import { NativeModules, Platform } from 'react-native';
import { parseWallpaperPalette, type WallpaperPalette } from './material-you.ts';

interface MaterialYouNative {
  getWallpaperPalette(isDark: boolean): Promise<unknown>;
}

export async function readWallpaperPalette(isDark: boolean): Promise<WallpaperPalette | null> {
  if (Platform.OS !== 'android') return null;
  const native = (NativeModules as { MaterialYou?: MaterialYouNative }).MaterialYou;
  if (!native || typeof native.getWallpaperPalette !== 'function') return null;
  try {
    return parseWallpaperPalette(await native.getWallpaperPalette(isDark));
  } catch {
    return null;
  }
}
