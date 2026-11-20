// Cover art picker (books, folders, notes). Native: the picked image is copied into
// `Paths.document/covers/` so it survives cache purges, and its file URI is returned. Web: the
// image comes back as a small JPEG data URI (blob: URLs die on reload). `null` when cancelled.
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { newSlugId } from '../store/ids.ts';

export async function pickCoverImage(): Promise<string | null> {
  const web = Platform.OS === 'web';
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: !web,
    aspect: [2, 3],
    quality: web ? 0.6 : 0.85,
    base64: web,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  if (web) return asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
  const dir = new Directory(Paths.document, 'covers');
  if (!dir.exists) dir.create({ intermediates: true });
  const ext = /\.(png|jpe?g|webp|heic)$/i.exec(asset.uri)?.[1]?.toLowerCase() ?? 'jpg';
  const dest = new File(dir, `${newSlugId()}.${ext}`);
  new File(asset.uri).copy(dest);
  return dest.uri;
}
