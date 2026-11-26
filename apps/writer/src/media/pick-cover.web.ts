// Web cover picker: the image comes back as a small JPEG data URI (blob: URLs die on reload).
// No files, no thumbnails: `BookCoverThumb` falls back to the data URI itself. `null` when cancelled.
import * as ImagePicker from 'expo-image-picker';
import type { PickedCover } from './cover-types.ts';

export async function pickCoverImage(): Promise<PickedCover | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.6,
    base64: true,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
  const bytes = asset.base64 ? Math.floor((asset.base64.length * 3) / 4) : 0;
  const cover = { uri, width: asset.width, height: asset.height, bytes, mimeType: 'image/jpeg' };
  return { cover, thumb: null };
}
